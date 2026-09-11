// Retrieval: runs the planned searches through MCP, normalises and
// de-duplicates what comes back, scores it, fetches the most promising pages
// and records every article in NewsArticle. Server only.
//
// Partial failure is normal here: a search that fails is counted and
// skipped, and the briefing is built from whatever succeeded. Only when
// every search fails because the MCP server is unreachable does this throw.

import NewsArticle from "@/models/NewsArticle";
import { searchNews, searchWeb, fetchPage } from "@/lib/mcp";
import { kindMeta, candidateLimitFor } from "@/lib/news/kinds";

export class RetrievalError extends Error {
  constructor(message, code = "retrieval_failed") {
    super(message);
    this.name = "RetrievalError";
    this.code = code;
  }
}

const REPUTABLE = new Set([
  "apnews.com", "reuters.com", "bbc.com", "bbc.co.uk", "nytimes.com", "washingtonpost.com", "theguardian.com",
  "ft.com", "wsj.com", "bloomberg.com", "cnbc.com", "economist.com", "theverge.com", "techcrunch.com",
  "arstechnica.com", "wired.com", "venturebeat.com", "theinformation.com", "axios.com", "infoq.com",
  "thenewstack.io", "github.blog", "openai.com", "anthropic.com", "deepmind.google", "blog.google",
  "developers.googleblog.com", "blogs.microsoft.com", "nextjs.org", "vercel.com", "react.dev", "nodejs.org",
  "arxiv.org", "nature.com", "science.org", "spectrum.ieee.org", "technologyreview.com", "sec.gov",
  "europa.eu", "gov.uk", "whitehouse.gov", "engadget.com", "zdnet.com", "theregister.com", "gamesindustry.biz",
  "eurogamer.net", "polygon.com", "ign.com", "hbr.org", "sciencedaily.com", "semianalysis.com",
]);

const LOW_QUALITY = new Map([
  ["pinterest.com", -1.5], ["quora.com", -1.2], ["facebook.com", -1.2], ["instagram.com", -1.2],
  ["tiktok.com", -1.2], ["x.com", -0.8], ["twitter.com", -0.8], ["linkedin.com", -0.8], ["amazon.com", -1.5],
  ["ebay.com", -1.5], ["reddit.com", -0.5], ["medium.com", -0.3], ["youtube.com", -0.6], ["wikipedia.org", -0.6],
  ["news.google.com", -1.5], ["bing.com", -1.5], ["msn.com", -0.4], ["yahoo.com", -0.3], ["glassdoor.com", -1],
  ["indeed.com", -1.2], ["prnewswire.com", -0.2], ["businesswire.com", -0.2], ["globenewswire.com", -0.2],
]);

function domainScore(domain) {
  for (const [bad, penalty] of LOW_QUALITY) {
    if (domain === bad || domain.endsWith(`.${bad}`)) return penalty;
  }
  if (REPUTABLE.has(domain)) return 0.5;
  for (const good of REPUTABLE) {
    if (domain.endsWith(`.${good}`)) return 0.4;
  }
  return 0;
}

/** Title key for near-duplicate detection: strip site suffixes, punctuation. */
export function titleKey(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\s+[-|–—:]\s+[^-|–—:]{2,40}$/, "") // "headline - The Verge"
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 90);
}

function tokens(title) {
  return new Set(titleKey(title).split(" ").filter((t) => t.length > 2));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** Run `tasks` (functions returning promises) with limited concurrency. */
async function pool(tasks, concurrency, shouldStart) {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next;
      next += 1;
      if (shouldStart && !shouldStart()) {
        results[i] = { skipped: true };
        continue;
      }
      try {
        results[i] = await tasks[i]();
      } catch (error) {
        results[i] = { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

function ageDays(date, now) {
  if (!date) return null;
  return (now - new Date(date).getTime()) / 86400000;
}

/**
 * @param {object} params
 * @param {{query: string, topic: string, purpose: "topic"|"broad"}[]} params.queries
 * @param {"daily"|"weekly"|"custom"} params.kind
 * @param {number} params.storyCount
 * @param {object[]} [params.feedback]          NewsFeedback rows (lean)
 * @param {Set<string>} [params.recentlyShownKeys] urlKeys shown in recent briefings
 * @param {number} [params.deadlineAt]           epoch ms after which no new work starts
 * @param {(msg: string) => void} [params.log]
 */
export async function retrieveCandidates({
  queries,
  kind,
  storyCount,
  feedback = [],
  recentlyShownKeys = new Set(),
  deadlineAt = Date.now() + 200000,
  log = () => {},
}) {
  const now = Date.now();
  const meta = kindMeta(kind);
  const { recencyDays, maxAgeDays } = meta;
  // Longer windows keep more of what they find, because the model is the
  // thing that decides what matters across a week or a month.
  const longWindow = meta.window !== "day";
  const warnings = [];
  const stats = {
    queries: queries.length,
    searchesOk: 0,
    searchesFailed: 0,
    searchesSkipped: 0,
    resultsRetrieved: 0,
    uniqueArticles: 0,
    pagesFetched: 0,
    pagesFailed: 0,
    tools: new Set(),
  };

  /* ── 1. search ─────────────────────────────────────────────────── */
  const searchDeadline = Math.min(deadlineAt, now + 110000);
  const failures = [];
  const searchTasks = queries.map((q) => async () => {
    let res = await searchNews(q.query, { maxResults: 10, recencyDays, timeoutMs: 25000 });
    if (!res.ok && !["not_configured", "connect_failed", "auth"].includes(res.error?.code)) {
      // Different tool or a transient error: give web search one chance.
      res = await searchWeb(q.query, { maxResults: 10, recencyDays, timeoutMs: 25000 });
    }
    return { q, res };
  });
  const searchResults = await pool(searchTasks, 3, () => Date.now() < searchDeadline);

  const byKey = new Map();
  for (const item of searchResults) {
    if (item?.skipped) {
      stats.searchesSkipped += 1;
      continue;
    }
    if (item?.error || !item?.res) {
      stats.searchesFailed += 1;
      failures.push({ code: "internal", message: item?.error?.message || "unknown" });
      continue;
    }
    const { q, res } = item;
    if (!res.ok) {
      stats.searchesFailed += 1;
      failures.push(res.error || { code: "unknown", message: "search failed" });
      log(`search failed [${q.query}]: ${res.error?.code} ${res.error?.message}`);
      continue;
    }
    stats.searchesOk += 1;
    if (res.tool) stats.tools.add(res.tool);
    for (const w of res.warnings || []) if (!warnings.includes(w)) warnings.push(w);
    stats.resultsRetrieved += res.results.length;
    res.results.forEach((r, index) => {
      const existing = byKey.get(r.key);
      const hit = q.purpose === "topic" ? q.topic : null;
      if (existing) {
        existing.queryCount += 1;
        existing.bestRank = Math.min(existing.bestRank, index);
        existing.mcpScore = Math.max(existing.mcpScore, r.score || 0);
        if (hit) existing.hits.add(hit);
        if (!existing.publishedAt && r.publishedAt) {
          existing.publishedAt = r.publishedAt;
          existing.publishedAtSource = r.publishedAtSource;
        }
        if (!existing.title && r.title) existing.title = r.title;
        if ((r.snippet || "").length > (existing.snippet || "").length) existing.snippet = r.snippet;
        return;
      }
      byKey.set(r.key, {
        ...r,
        queryCount: 1,
        bestRank: index,
        mcpScore: r.score || 0,
        hits: new Set(hit ? [hit] : []),
        broad: q.purpose === "broad",
        tool: res.tool,
      });
    });
  }

  if (stats.searchesSkipped) {
    warnings.push(`${stats.searchesSkipped} of ${queries.length} searches were skipped to stay within the time limit.`);
  }
  if (stats.searchesFailed && stats.searchesOk) {
    warnings.push(`${stats.searchesFailed} of ${queries.length} searches failed; the briefing uses the remaining results.`);
  }
  if (!stats.searchesOk && queries.length) {
    const first = failures[0] || {};
    const code = first.code || "search_failed";
    const fatal = ["not_configured", "connect_failed", "auth", "tool_not_found", "rate_limited"].includes(code)
      ? code
      : "search_failed";
    throw new RetrievalError(
      fatal === "connect_failed"
        ? `The MCP server could not be reached: ${first.message || "connection failed"}`
        : fatal === "auth"
          ? "The MCP server rejected the request (check its API key)."
          : fatal === "rate_limited"
            ? "The search provider is rate limiting requests. Try again in a few minutes."
            : fatal === "tool_not_found"
              ? first.message || "The MCP server exposes no search tool."
              : `Every search failed: ${first.message || "unknown error"}`,
      fatal,
    );
  }

  /* ── 2. de-duplicate near-identical stories ─────────────────────── */
  const items = [...byKey.values()];
  const merged = [];
  const tokenCache = items.map((i) => tokens(i.title));
  const mergedTokens = [];
  items.forEach((item, i) => {
    let dupOf = -1;
    for (let j = 0; j < merged.length; j += 1) {
      if (merged[j].domain === item.domain && titleKey(merged[j].title) === titleKey(item.title) && titleKey(item.title)) {
        dupOf = j;
        break;
      }
      if (jaccard(tokenCache[i], mergedTokens[j]) >= 0.8) {
        dupOf = j;
        break;
      }
    }
    if (dupOf >= 0) {
      const target = merged[dupOf];
      target.queryCount += item.queryCount;
      target.mcpScore = Math.max(target.mcpScore, item.mcpScore);
      for (const h of item.hits) target.hits.add(h);
      target.duplicates = (target.duplicates || 0) + 1;
      // Keep the better-known domain as the canonical one. Its metadata
      // travels with it: title, snippet and date must describe the page the
      // stored URL points at, never the duplicate it replaced.
      if (domainScore(item.domain) > domainScore(target.domain)) {
        Object.assign(target, {
          url: item.url,
          key: item.key,
          domain: item.domain,
          publisher: item.publisher,
          title: item.title,
          snippet: item.snippet,
          excerpt: item.excerpt,
          publishedAt: item.publishedAt,
          publishedAtSource: item.publishedAtSource,
        });
        mergedTokens[dupOf] = tokenCache[i];
      }
      return;
    }
    merged.push(item);
    mergedTokens.push(tokenCache[i]);
  });
  stats.uniqueArticles = merged.length;

  /* ── 3. score ───────────────────────────────────────────────────── */
  const dislikedDomains = new Map();
  const likedDomains = new Map();
  for (const f of feedback) {
    if (!f.domain) continue;
    const map = f.value === "not_relevant" || f.value === "not_interested" ? dislikedDomains : likedDomains;
    map.set(f.domain, (map.get(f.domain) || 0) + 1);
  }

  const scored = merged
    .filter((item) => {
      const age = ageDays(item.publishedAt, now);
      return age === null || age <= maxAgeDays;
    })
    .map((item) => {
      const age = ageDays(item.publishedAt, now);
      let score = 1;
      score += 0.6 * (item.queryCount - 1);
      score += item.hits.size ? 1 : 0;
      score += Math.min(1, Math.max(0, item.mcpScore));
      score += Math.max(0, 0.5 - item.bestRank * 0.05);
      score += age === null ? 0 : age <= 1 ? 0.8 : age <= 3 ? 0.4 : 0;
      score += domainScore(item.domain);
      // Feedback is about stories, not publishers, so the domain signal is
      // gentle: it only kicks in from the second verdict on the same domain
      // and never outweighs a topic match. The story-level feedback itself is
      // given to the model as text when it ranks.
      score -= Math.min(0.6, 0.3 * Math.max(0, (dislikedDomains.get(item.domain) || 0) - 1));
      score += Math.min(0.4, 0.2 * Math.max(0, (likedDomains.get(item.domain) || 0) - 1));
      if (recentlyShownKeys.has(item.key)) score -= longWindow ? 0.3 : 0.9;
      if (!item.title) score -= 0.5;
      if (item.duplicates) score += Math.min(0.6, 0.2 * item.duplicates);
      return { ...item, hits: [...item.hits], score };
    })
    .sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, candidateLimitFor(kind, storyCount));

  /* ── 4. fetch full text for the strongest candidates ────────────── */
  const fetchLimit = Math.min(10, storyCount + 3);
  const keys = candidates.map((c) => c.key);
  const known = keys.length ? await NewsArticle.find({ urlKey: { $in: keys } }).lean() : [];
  const knownByKey = new Map(known.map((a) => [a.urlKey, a]));
  const freshExcerptCutoff = now - 24 * 3600000;

  let fetchUnavailable = false;
  const toFetch = candidates.slice(0, fetchLimit).filter((c) => {
    const k = knownByKey.get(c.key);
    if (k?.excerpt && k.excerptFetchedAt && new Date(k.excerptFetchedAt).getTime() > freshExcerptCutoff) {
      c.excerpt = k.excerpt;
      return false;
    }
    return true;
  });
  const fetchDeadline = Math.min(deadlineAt, Date.now() + 70000);
  const fetchResults = await pool(
    toFetch.map((c) => async () => {
      if (fetchUnavailable) return { skipped: true };
      const res = await fetchPage(c.url, { maxChars: 4500, timeoutMs: 20000 });
      if (!res.ok && res.error?.code === "tool_not_found") fetchUnavailable = true;
      return { c, res };
    }),
    3,
    () => Date.now() < fetchDeadline,
  );
  for (const item of fetchResults) {
    if (!item || item.skipped || !item.c) continue;
    if (item.res.ok) {
      stats.pagesFetched += 1;
      item.c.excerpt = item.res.text;
      item.c.excerptFetchedAt = new Date();
      if (!item.c.title && item.res.title) item.c.title = item.res.title;
      if (item.res.tool) stats.tools.add(item.res.tool);
    } else {
      stats.pagesFailed += 1;
    }
  }
  if (fetchUnavailable) warnings.push("The MCP server has no page-fetch tool; stories are summarised from search snippets.");
  else if (stats.pagesFailed && !stats.pagesFetched && toFetch.length) warnings.push("Article pages could not be fetched; stories are summarised from search snippets.");

  /* ── 5. record the articles ─────────────────────────────────────── */
  if (candidates.length) {
    const ops = candidates.map((c) => {
      const set = {
        url: c.url,
        domain: c.domain,
        publisher: c.publisher,
        lastSeenAt: new Date(),
        lastScore: c.score,
        "retrievedVia.tool": c.tool || "",
      };
      if (c.title) set.title = c.title.slice(0, 500);
      if (c.snippet) set.snippet = c.snippet.slice(0, 1200);
      if (c.publishedAt) {
        set.publishedAt = c.publishedAt;
        set.publishedAtSource = c.publishedAtSource || "";
      }
      if (c.excerptFetchedAt) {
        set.excerpt = c.excerpt.slice(0, 6000);
        set.excerptFetchedAt = c.excerptFetchedAt;
      }
      return { updateOne: { filter: { urlKey: c.key }, update: { $set: set, $setOnInsert: { urlKey: c.key } }, upsert: true } };
    });
    try {
      await NewsArticle.bulkWrite(ops, { ordered: false });
    } catch (error) {
      log(`article upsert failed: ${error?.message}`);
      warnings.push("Some articles could not be saved to the database.");
    }
    const docs = await NewsArticle.find({ urlKey: { $in: keys } }).select({ _id: 1, urlKey: 1, excerpt: 1, publishedAt: 1, publishedAtSource: 1, title: 1 }).lean();
    const docByKey = new Map(docs.map((d) => [d.urlKey, d]));
    for (const c of candidates) {
      const d = docByKey.get(c.key);
      if (!d) continue;
      c.articleId = d._id;
      if (!c.excerpt && d.excerpt) c.excerpt = d.excerpt;
      if (!c.publishedAt && d.publishedAt) {
        c.publishedAt = d.publishedAt;
        c.publishedAtSource = d.publishedAtSource;
      }
      if (!c.title && d.title) c.title = d.title;
    }
  }

  return {
    candidates: candidates.map((c, i) => ({
      id: i + 1,
      articleId: c.articleId || null,
      key: c.key,
      url: c.url,
      domain: c.domain,
      publisher: c.publisher,
      title: c.title,
      snippet: c.snippet,
      excerpt: c.excerpt || "",
      publishedAt: c.publishedAt || null,
      publishedAtSource: c.publishedAtSource || "",
      score: Number(c.score.toFixed(2)),
      hits: c.hits,
      broad: c.broad,
    })),
    stats: { ...stats, tools: [...stats.tools] },
    warnings,
  };
}

/**
 * Lightweight search used by "ask about a story": returns normalised
 * results, optionally with fetched excerpts, without touching NewsArticle.
 */
export async function searchForContext({ queries, recencyDays, excludeKeys = new Set(), fetchCount = 3 }) {
  const results = await pool(
    queries.map((q) => () => searchWeb(q, { maxResults: 8, recencyDays, timeoutMs: 20000 })),
    3,
  );
  const byKey = new Map();
  let ok = 0;
  let failed = 0;
  for (const res of results) {
    if (!res || res.error || !res.ok) {
      failed += 1;
      continue;
    }
    ok += 1;
    res.results.forEach((r, index) => {
      if (excludeKeys.has(r.key)) return;
      const existing = byKey.get(r.key);
      if (existing) {
        existing.count += 1;
        return;
      }
      byKey.set(r.key, { ...r, count: 1, rank: index });
    });
  }
  const items = [...byKey.values()]
    .map((i) => ({ ...i, score: i.count + Math.max(0, 0.5 - i.rank * 0.05) + domainScore(i.domain) + (i.score || 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const fetched = await pool(
    items.slice(0, fetchCount).map((i) => async () => ({ i, res: await fetchPage(i.url, { maxChars: 3500, timeoutMs: 15000 }) })),
    3,
  );
  for (const f of fetched) {
    if (f?.res?.ok) f.i.excerpt = f.res.text;
  }
  return { items, searchesOk: ok, searchesFailed: failed };
}
