// Client for the movez-studio news hub (its /api/v1/news API). Server only.
//
// The hub collects news for every app (publisher feeds, Google News, then
// capped NewsAPI.ai / Tavily) and answers one search per briefing edition;
// pomo2 keeps doing the AI writing. Configured with NEWS_HUB_URL and
// NEWS_HUB_API_KEY (a key made in movez-studio Admin → News → App keys).
//
// Like the MCP layer, nothing here throws for operational failures: calls
// return { ok: false, error: { code, message } } with the codes retrieval
// already understands (auth, rate_limited, quota_exceeded, connect_failed,
// timeout, search_failed).

import { recordExternalCall } from "@/lib/usage/track";

const base = () => (process.env.NEWS_HUB_URL || "").trim().replace(/\/+$/, "");
const key = () => (process.env.NEWS_HUB_API_KEY || "").trim();

export function hubNewsConfigured() {
  return Boolean(base() && key());
}

function errorFrom(status, body) {
  const message = body?.error || `HTTP ${status}`;
  if (status === 401 || status === 403) return { code: "auth", message };
  if (status === 429) return { code: body?.code === "quota_exceeded" ? "quota_exceeded" : "rate_limited", message };
  if (status === 400) return { code: "bad_request", message };
  return { code: "search_failed", message };
}

async function call(path, { method = "GET", body, timeoutMs = 30000, label = path } = {}) {
  if (!hubNewsConfigured()) {
    return { ok: false, error: { code: "not_configured", message: "NEWS_HUB_URL / NEWS_HUB_API_KEY are not set." } };
  }
  try {
    const res = await fetch(`${base()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key()}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(Math.max(3000, timeoutMs)),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    recordExternalCall({ provider: "news-hub", model: label, ok: res.ok });
    if (!res.ok) return { ok: false, error: errorFrom(res.status, json) };
    return { ok: true, data: json };
  } catch (error) {
    recordExternalCall({ provider: "news-hub", model: label, ok: false });
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      ok: false,
      error: timeout
        ? { code: "timeout", message: "The news hub took too long to answer." }
        : { code: "connect_failed", message: `The news hub could not be reached: ${error?.message || error}` },
    };
  }
}

/**
 * One search: `{ queries:[{text,tag}], countries, language, since, sources:{ids,mode},
 * limit, fullText:{top,maxChars}, deadlineMs }`. Answers
 * `{ ok, items, stats, warnings }` (see the hub's src/lib/news/engine.ts).
 */
export async function hubSearch(request, { deadlineAt } = {}) {
  const left = deadlineAt ? deadlineAt - Date.now() : 90000;
  const deadlineMs = Math.max(5000, Math.min(90000, left - 5000));
  const res = await call("/api/v1/news/search", {
    method: "POST",
    body: { ...request, deadlineMs },
    // The hub stops at deadlineMs; leave it time to answer.
    timeoutMs: deadlineMs + 10000,
    label: "search",
  });
  if (!res.ok) return res;
  return {
    ok: true,
    items: Array.isArray(res.data?.items) ? res.data.items : [],
    stats: res.data?.stats || {},
    warnings: Array.isArray(res.data?.warnings) ? res.data.warnings : [],
  };
}

/** The hub's source catalogue, optionally filtered by country, language or text. */
export async function hubSources({ country = "", language = "", q = "" } = {}) {
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  if (language) params.set("language", language);
  if (q) params.set("q", q);
  const res = await call(`/api/v1/news/sources${params.size ? `?${params}` : ""}`, { timeoutMs: 15000, label: "sources" });
  if (!res.ok) return res;
  return { ok: true, sources: Array.isArray(res.data?.sources) ? res.data.sources : [] };
}

/** Provider health and budgets, for the Connection report. */
export async function hubStatus() {
  const res = await call("/api/v1/news/status", { timeoutMs: 15000, label: "status" });
  return res.ok ? { ok: true, ...res.data } : res;
}

/**
 * The hub's written stories of a period ("daily" | "weekly", key "latest"
 * or "2026-10-26" / "2026-W43") for languages, topics and countries:
 * `{ ok, periodKey, digests: [{ language, topic, topicName, trends,
 * stories: [{ id, rank, headline, summary, whyItMatters, countries,
 * coverage, sources }] }] }`.
 */
export async function hubStories({ period = "daily", key: periodKey = "latest", languages = [], topics = [], countries = [] } = {}) {
  const params = new URLSearchParams({ period, key: periodKey });
  if (languages.length) params.set("languages", languages.join(","));
  if (topics.length) params.set("topics", topics.join(","));
  if (countries.length) params.set("countries", countries.join(","));
  const res = await call(`/api/v1/news/stories?${params}`, { timeoutMs: 20000, label: "stories" });
  if (!res.ok) return res;
  return {
    ok: true,
    periodKey: res.data?.periodKey || null,
    digests: Array.isArray(res.data?.digests) ? res.data.digests : [],
  };
}

/** One hub story by id (to save it). */
export async function hubStory(id) {
  const res = await call(`/api/v1/news/stories/${encodeURIComponent(id)}`, { timeoutMs: 15000, label: "story" });
  return res.ok ? { ok: true, story: res.data?.story || null } : res;
}

/** The hub's topic list (the same in every app). */
export async function hubTopics() {
  const res = await call("/api/v1/news/topics", { timeoutMs: 15000, label: "topics" });
  return res.ok ? { ok: true, topics: Array.isArray(res.data?.topics) ? res.data.topics : [] } : res;
}
