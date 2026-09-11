// "Ask about a story": answers a follow-up question from the story's own
// sources plus, when the question needs it, fresh material retrieved through
// MCP. Server only.

import NewsArticle from "@/models/NewsArticle";
import { isMcpConfigured } from "@/lib/mcp";
import { planFollowup, answerStoryQuestion, isOpenAiConfigured, AiError } from "@/lib/ai";
import { searchForContext } from "@/lib/news/retrieval";
import { groundAnswer } from "@/lib/news/validate";
import { canonicalizeUrl } from "@/lib/mcp/normalize";

export class AskError extends Error {
  constructor(message, code = "ask_failed", status = 400) {
    super(message);
    this.name = "AskError";
    this.code = code;
    this.status = status;
  }
}

/**
 * @param {{ story: object, question: string, log?: (m: string) => void }} params
 *   story: a BriefingStory document (lean or hydrated)
 */
export async function askAboutStory({ story, question, log = () => {}, budgetMs = 110000 }) {
  if (!isOpenAiConfigured()) throw new AskError("OPENAI_API_KEY is not set on the server.", "ai_not_configured", 503);
  // Every step draws from one budget, so planning + searching + answering
  // always leaves time to return a reply within the route's limit.
  const deadlineAt = Date.now() + budgetMs;
  const remaining = () => deadlineAt - Date.now();

  // 1. The story's own sources, with the stored excerpts.
  const storySources = [{ url: story.url, title: story.headline, publisher: story.publisher, publishedAt: story.publishedAt }, ...(story.sources || [])];
  const keys = [];
  const seen = new Set();
  for (const s of storySources) {
    const canon = canonicalizeUrl(s.url);
    if (!canon || seen.has(canon.key)) continue;
    seen.add(canon.key);
    keys.push({ ...s, key: canon.key, url: canon.url, domain: canon.domain });
  }
  const articles = keys.length ? await NewsArticle.find({ urlKey: { $in: keys.map((k) => k.key) } }).lean() : [];
  const byKey = new Map(articles.map((a) => [a.urlKey, a]));

  const sources = keys.map((k, i) => {
    const a = byKey.get(k.key);
    return {
      id: i + 1,
      url: k.url,
      key: k.key,
      title: a?.title || k.title || "",
      publisher: a?.publisher || k.publisher || k.domain,
      domain: k.domain,
      publishedAt: a?.publishedAt || k.publishedAt || null,
      snippet: a?.snippet || "",
      excerpt: a?.excerpt || "",
      fromStory: true,
    };
  });

  // 2. Decide whether to search, then search through MCP.
  let searched = false;
  let queries = [];
  let searchWarning = "";
  try {
    const plan = await planFollowup({
      story,
      question,
      sourceTitles: sources.map((s) => s.title).filter(Boolean),
      deadlineAt,
    });
    queries = plan.queries;
    if (plan.needsSearch && remaining() < 60000) {
      searchWarning = "There was not enough time to search for more context, so the answer only uses the story's existing sources.";
    } else if (plan.needsSearch) {
      if (!isMcpConfigured()) {
        searchWarning = "No MCP server is configured, so the answer only uses the story's existing sources.";
      } else {
        const ctx = await searchForContext({
          queries: plan.queries,
          recencyDays: plan.recencyDays,
          excludeKeys: new Set(sources.map((s) => s.key)),
          fetchCount: 3,
        });
        searched = ctx.searchesOk > 0;
        if (!ctx.searchesOk) searchWarning = "Fresh web searches failed, so the answer only uses the story's existing sources.";
        ctx.items.forEach((item) => {
          sources.push({
            id: sources.length + 1,
            url: item.url,
            key: item.key,
            title: item.title,
            publisher: item.publisher,
            domain: item.domain,
            publishedAt: item.publishedAt,
            snippet: item.snippet,
            excerpt: item.excerpt || "",
            fromStory: false,
          });
        });
      }
    }
  } catch (error) {
    log(`follow-up planning failed: ${error?.message}`);
    searchWarning = "Could not plan extra searches; the answer only uses the story's existing sources.";
  }

  // 3. Answer, grounded in the numbered sources.
  let result;
  try {
    result = await answerStoryQuestion({ story, question, sources, deadlineAt });
  } catch (error) {
    if (error instanceof AiError && error.code === "rate_limited") {
      throw new AskError("OpenAI is rate limiting requests right now. Try again in a minute.", "ai_rate_limited", 429);
    }
    log(`answer failed: ${error?.message || error}`);
    if (error instanceof AiError && error.code === "timeout") {
      throw new AskError("OpenAI took too long to answer. Try again.", "ai_timeout", 504);
    }
    if (error instanceof AiError && ["auth", "not_configured"].includes(error.code)) {
      throw new AskError("The server's OpenAI key was rejected. Check OPENAI_API_KEY.", "ai_auth", 503);
    }
    throw new AskError("The AI step failed. Try again shortly.", "ai_error", 502);
  }
  const grounded = groundAnswer({ data: result.data, sources });
  const citedSet = new Set(grounded.citations);

  const warnings = [...(grounded.warnings || [])];
  if (searchWarning) warnings.unshift(searchWarning);

  return {
    answer: grounded.answer,
    insufficient: grounded.insufficient,
    searched,
    queries,
    warning: warnings.join(" "),
    warnings,
    sources: sources
      .filter((s) => citedSet.has(s.id) || s.fromStory)
      .map((s) => ({
        id: s.id,
        url: s.url,
        title: s.title,
        publisher: s.publisher,
        publishedAt: s.publishedAt,
        cited: citedSet.has(s.id),
        fromStory: s.fromStory,
      })),
    model: result.model,
  };
}
