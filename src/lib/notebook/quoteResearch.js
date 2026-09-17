// Web research for an author's quotes, through the MCP layer. Server only.
//
// Searches the configured MCP server for pages that collect the author's
// quotes, fetches the best few and hands their text to the AI layer as
// numbered material (src/lib/ai/quotes.js). Nothing here interprets the
// pages; it only retrieves them.

import { searchWeb, fetchPage, isMcpConfigured } from "@/lib/mcp";

export { isMcpConfigured };

const PAGE_CHARS = 7000;
const PAGES = 5;

// Sites built around quotations rank first; the rest keep their search order.
const QUOTE_SITES = ["wikiquote.org", "goodreads.com", "brainyquote.com", "azquotes.com", "quotefancy.com"];

function domainScore(domain = "") {
  const host = domain.toLowerCase();
  if (QUOTE_SITES.some((s) => host === s || host.endsWith(`.${s}`))) return 3;
  if (host.includes("quote")) return 1.5;
  return 0;
}

async function pool(tasks, concurrency) {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next;
      next += 1;
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

/**
 * @param {{ author: string, work?: string, topic?: string }} params
 * @returns {Promise<{ material: { id, title, url, domain, text }[], searches: number, failed: number, error: string|null }>}
 */
export async function researchQuotes({ author, work = "", topic = "" }) {
  const name = String(author || "").trim();
  const title = String(work || "").trim();
  const theme = String(topic || "").trim();
  // A named work is what the search should be about; the author only places
  // it. Without one, the author's best-known lines are the target.
  const queries = title
    ? [`"${title}" quotes`, `${name} "${title}" quotes${theme ? ` ${theme}` : ""}`]
    : [`"${name}" quotes`, theme ? `${name} quotes ${theme}` : `${name} famous quotes sayings`];

  const searches = await Promise.all(
    queries.map((q) => searchWeb(q, { maxResults: 8, recencyDays: null, timeoutMs: 20000 })),
  );
  const failed = searches.filter((s) => !s.ok);
  const byKey = new Map();
  searches.forEach((s) => {
    if (!s.ok) return;
    s.results.forEach((r, index) => {
      const existing = byKey.get(r.key);
      if (existing) {
        existing.count += 1;
        return;
      }
      byKey.set(r.key, { ...r, count: 1, rank: index });
    });
  });

  const ranked = [...byKey.values()]
    .map((r) => ({ ...r, weight: r.count + Math.max(0, 0.5 - r.rank * 0.05) + domainScore(r.domain) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, PAGES);

  const fetched = await pool(
    ranked.map((r) => async () => ({ r, res: await fetchPage(r.url, { maxChars: PAGE_CHARS, timeoutMs: 20000 }) })),
    3,
  );

  const material = [];
  for (const f of fetched) {
    if (!f?.res?.ok || !f.res.text?.trim()) continue;
    material.push({
      id: material.length + 1,
      title: f.res.title || f.r.title || "",
      url: f.r.url,
      domain: f.r.domain || "",
      text: f.res.text,
    });
  }

  return {
    material,
    searches: searches.length,
    failed: failed.length,
    error: failed.length === searches.length ? failed[0]?.error?.message || "Web search failed" : null,
  };
}
