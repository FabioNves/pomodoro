// Briefing generation: the end-to-end pipeline. Server only.
//
//   preferences + topics + feedback
//     -> AI plans search queries
//     -> MCP runs the searches and fetches pages      (retrieval.js)
//     -> AI ranks, de-duplicates and summarises        (lib/ai)
//     -> validator keeps only source-backed stories    (validate.js)
//     -> Briefing + BriefingStory documents
//
// startBriefing() creates the Briefing row (status "generating") and
// runBriefingGeneration() does the work; the API route runs the latter in
// next/server's after() so the HTTP request returns immediately, while the
// cron route awaits it directly.

import { connectToDB } from "@/lib/db";
import Briefing from "@/models/Briefing";
import BriefingStory from "@/models/BriefingStory";
import NewsFeedback from "@/models/NewsFeedback";
import NewsPreference from "@/models/NewsPreference";
import { isMcpConfigured } from "@/lib/mcp";
import { planSearchQueries, synthesizeBriefing, isOpenAiConfigured, AiError } from "@/lib/ai";
import { getOrCreatePreferences, listTopics } from "@/lib/news/preferences";
import { retrieveCandidates, RetrievalError } from "@/lib/news/retrieval";
import { groundBriefing } from "@/lib/news/validate";
import { currentPeriodKey, periodLabel, greetingFor, safeTimeZone } from "@/lib/news/schedule";
import { canonicalizeUrl } from "@/lib/mcp/normalize";
import { kindMeta, maxQueriesFor } from "@/lib/news/kinds";

// A Vercel function lives at most 300 s. The pipeline plans its work inside
// that budget and a briefing still "generating" after this long is assumed
// to have died with its function.
export const FUNCTION_BUDGET_MS = 300 * 1000;
export const GENERATION_STALE_MS = 6 * 60 * 1000;
// Below this there is not enough time to search and summarise, so the caller
// (the cron) should defer the cycle to its next run instead of starting one
// it cannot finish.
export const MIN_GENERATION_MS = 100 * 1000;

// Failures worth retrying on a later run: the input was fine, the moment was
// not. Anything else (missing configuration, no topics, rejected keys) will
// fail again until a human changes something.
const TRANSIENT_ERROR_CODES = new Set([
  "timeout",
  "internal",
  "ai_timeout",
  "ai_rate_limited",
  "ai_api_error",
  "ai_invalid_json",
  "ai_truncated",
  "mcp_connect_failed",
  "mcp_rate_limited",
  "mcp_search_failed",
  "mcp_timeout",
]);

export function isTransientFailure(errorCode) {
  return TRANSIENT_ERROR_CODES.has(String(errorCode || ""));
}

/**
 * Error text safe to store on the briefing and show in the browser.
 *
 * Upstream bodies can carry configuration detail (OpenAI echoes a partially
 * redacted key in its 401, MCP servers echo their own errors), so the reader
 * gets a plain sentence and the operator gets the detail in the server log.
 */
function safeMessage(code, detail) {
  const map = {
    ai_auth: "The server's OpenAI key was rejected. Check OPENAI_API_KEY.",
    ai_rate_limited: "OpenAI is rate limiting requests right now. Try again in a few minutes.",
    ai_timeout: "OpenAI took too long to answer. Try again.",
    ai_truncated: "The briefing was too long to finish. Try a shorter briefing length.",
    ai_invalid_json: "The AI returned an unreadable answer. Try again.",
    ai_refusal: "The AI declined to summarise this material.",
    ai_api_error: "OpenAI could not be reached. Try again shortly.",
    ai_not_configured: "OPENAI_API_KEY is not set on the server.",
    mcp_not_configured: "No MCP server is configured. Set MCP_SERVER_URL on the server.",
    mcp_connect_failed: "The MCP server could not be reached.",
    mcp_auth: "The MCP server rejected its credentials. Check its API key.",
    mcp_rate_limited: "The search provider is rate limiting requests. Try again in a few minutes.",
    mcp_tool_not_found: "The MCP server exposes no web-search tool.",
    mcp_search_failed: "Every web search failed. Try again shortly.",
    internal: "Something went wrong while building the briefing.",
  };
  if (map[code]) return map[code];
  return detail || "The briefing could not be generated.";
}

export class GenerationError extends Error {
  constructor(message, code = "generation_failed", status = 400) {
    super(message);
    this.name = "GenerationError";
    this.code = code;
    this.status = status;
  }
}

/** Mark "generating" briefings that outlived the function as failed. */
export async function markStaleBriefings(userId) {
  const cutoff = new Date(Date.now() - GENERATION_STALE_MS);
  await Briefing.updateMany(
    { user: userId, status: "generating", startedAt: { $lt: cutoff } },
    {
      $set: {
        status: "failed",
        error: "Generation did not finish in time. Try again.",
        errorCode: "timeout",
        completedAt: new Date(),
      },
    },
  );
}

/**
 * Create the Briefing row. Throws GenerationError when one is already running.
 * @param {{ userId: string, kind: "daily"|"weekly"|"custom", trigger: "manual"|"scheduled", periodKey?: string }} params
 */
export async function startBriefing({ userId, kind, trigger = "manual", periodKey }) {
  await connectToDB();
  await markStaleBriefings(userId);

  const running = await Briefing.findOne({ user: userId, status: "generating" }).sort({ startedAt: -1 });
  if (running) {
    throw new GenerationError("A briefing is already being generated.", "already_running", 409);
  }

  const { pref } = await getOrCreatePreferences(userId);
  const timezone = safeTimeZone(pref.timezone || "UTC");
  const key = periodKey || currentPeriodKey(new Date(), timezone);

  let briefing;
  try {
    briefing = await Briefing.create({
      user: userId,
      kind,
      trigger,
      periodKey: key,
      timezone,
      status: "generating",
      startedAt: new Date(),
    });
  } catch (error) {
    // A partial unique index on (user, status="generating") makes the check
    // above atomic: two requests that raced both get here, only one wins.
    if (error?.code === 11000) {
      throw new GenerationError("A briefing is already being generated.", "already_running", 409);
    }
    throw error;
  }

  // `lastScheduled` is only advanced once the cycle produced something, so a
  // transient failure can still be retried by a later cron run.
  return briefing;
}

/** Record that a scheduled cycle is finished and should not run again. */
export async function markCycleDelivered(userId, kind, periodKey) {
  await NewsPreference.updateOne(
    { user: userId },
    { $set: { [`lastScheduled.${kind}`]: periodKey } },
  );
}

function fallbackQueries({ topics, kind, includeWorthKnowing }) {
  const meta = kindMeta(kind);
  const period = { day: "today", week: "this week", month: "this month" }[meta.window] || "today";
  const queries = [];
  for (const t of topics) {
    queries.push({ query: t, topic: t, purpose: "topic" });
    if (meta.window !== "day") queries.push({ query: `${t} ${period}`, topic: t, purpose: "topic" });
  }
  if (includeWorthKnowing) {
    queries.push({ query: `top news ${period}`, topic: "broad", purpose: "broad" });
    queries.push({ query: `major technology news ${period}`, topic: "broad", purpose: "broad" });
  }
  return queries.slice(0, maxQueriesFor(kind));
}

async function recentlyShown(userId, kind, excludeId) {
  const recent = await Briefing.find({ user: userId, kind, status: "ready", _id: { $ne: excludeId } })
    .sort({ createdAt: -1 })
    .limit(3)
    .select({ _id: 1 })
    .lean();
  if (!recent.length) return { keys: new Set(), headlines: [] };
  const stories = await BriefingStory.find({ briefing: { $in: recent.map((b) => b._id) } })
    .select({ headline: 1, url: 1, sources: 1 })
    .lean();
  const keys = new Set();
  for (const s of stories) {
    for (const src of [{ url: s.url }, ...(s.sources || [])]) {
      const canon = canonicalizeUrl(src.url);
      if (canon) keys.add(canon.key);
    }
  }
  return { keys, headlines: stories.map((s) => s.headline) };
}

function titleFor(kind, periodKey, timezone, at) {
  if (kind === "weekly") return "Your week in review";
  if (kind === "monthly") return "Your month in review";
  return `${greetingFor(at, timezone)}.`;
}

/**
 * Run the pipeline for an existing "generating" briefing. Never throws:
 * every failure is recorded on the document.
 */
export async function runBriefingGeneration(
  briefingId,
  { log = (m) => console.log(`[news] ${m}`), budgetMs } = {},
) {
  const startedAt = Date.now();
  // Hard stop for the whole pipeline, with headroom before the platform
  // kills the function. Every stage derives its own timeout from what is
  // left, so a slow retrieval shortens (never skips) the synthesis step.
  // The cron passes its own remaining time so a generation started late in a
  // shared invocation cannot outlive it.
  const budget = Math.max(MIN_GENERATION_MS, Math.min(budgetMs || FUNCTION_BUDGET_MS, FUNCTION_BUDGET_MS));
  const deadlineAt = startedAt + budget - 25000;
  const remaining = () => deadlineAt - Date.now();
  await connectToDB();
  const briefing = await Briefing.findById(briefingId);
  if (!briefing || briefing.status !== "generating") return briefing;

  const warnings = [];
  const stats = {};
  const fail = async (code, detail) => {
    // The detail goes to the server log; the reader sees a safe sentence.
    log(`briefing ${briefingId} failed: ${code} ${detail}`);
    briefing.status = "failed";
    briefing.error = safeMessage(code, detail);
    briefing.errorCode = code;
    briefing.completedAt = new Date();
    briefing.stats = { ...briefing.stats?.toObject?.(), ...stats, durationMs: Date.now() - startedAt, warnings };
    await briefing.save();
    return briefing;
  };

  try {
    if (!isMcpConfigured()) {
      return fail("mcp_not_configured", "No MCP server is configured. Set MCP_SERVER_URL on the server.");
    }
    if (!isOpenAiConfigured()) {
      return fail("ai_not_configured", "OPENAI_API_KEY is not set on the server.");
    }

    const { pref } = await getOrCreatePreferences(briefing.user);
    const topicDocs = await listTopics(briefing.user);
    const topics = topicDocs.map((t) => t.name);
    const feedback = await NewsFeedback.find({ user: briefing.user }).sort({ updatedAt: -1 }).limit(60).lean();
    const shown = await recentlyShown(briefing.user, briefing.kind, briefing._id);
    const kind = briefing.kind;
    const includeWorthKnowing = pref.includeWorthKnowing !== false;

    if (!topics.length && !includeWorthKnowing && !pref.customInterests?.trim()) {
      return fail("no_topics", "Add at least one topic (or enable “Worth knowing”) before generating a briefing.");
    }

    /* 1. plan queries */
    let queries = [];
    let plannerModel = "";
    try {
      const plan = await planSearchQueries({
        topics,
        customInterests: pref.customInterests,
        kind,
        majorNewsOnly: Boolean(pref.majorNewsOnly),
        includeWorthKnowing,
        feedback,
        maxQueries: maxQueriesFor(kind),
        timeoutMs: 30000,
        retries: 1,
        deadlineAt,
      });
      queries = plan.queries;
      plannerModel = plan.model;
    } catch (error) {
      log(`query planning failed (${error?.code || "error"}): ${error?.message}`);
      // A rejected or missing key will fail the summarising step too, so stop
      // now rather than spending the whole retrieval budget first.
      if (error instanceof AiError && ["auth", "not_configured"].includes(error.code)) {
        return fail(`ai_${error.code}`, error.message);
      }
      warnings.push("Search planning fell back to simple topic queries.");
    }
    if (!queries.length) queries = fallbackQueries({ topics, kind, includeWorthKnowing });
    if (!queries.length) {
      return fail("no_topics", "Nothing to search for. Add a topic or describe your interests.");
    }
    log(`briefing ${briefingId}: ${queries.length} queries`);

    /* 2. retrieve through MCP */
    const retrieval = await retrieveCandidates({
      queries,
      kind,
      storyCount: pref.storyCount || 7,
      feedback,
      recentlyShownKeys: shown.keys,
      // Leave at least 90 s for the synthesis step.
      deadlineAt: Math.min(deadlineAt - 90000, startedAt + 180000),
      log,
    });
    Object.assign(stats, retrieval.stats, { mcpServer: retrieval.stats.tools.join(", ") });
    delete stats.tools;
    warnings.push(...retrieval.warnings);
    log(`briefing ${briefingId}: ${retrieval.candidates.length} candidates, ${stats.pagesFetched} pages fetched`);

    if (!retrieval.candidates.length) {
      briefing.status = "empty";
      briefing.title = titleFor(kind, briefing.periodKey, briefing.timezone, new Date());
      briefing.note = "No recent, relevant results were retrieved for your topics. Try broader topics or generate again later.";
      briefing.completedAt = new Date();
      briefing.stats = { ...stats, model: plannerModel, durationMs: Date.now() - startedAt, warnings };
      await briefing.save();
      return briefing;
    }

    /* 3. synthesise with the AI */
    let synthesis;
    try {
      const left = remaining();
      const synthesisTimeout = Math.max(20000, Math.min(120000, left - 8000));
      const synthesisRetries = left > 250000 ? 2 : left > 130000 ? 1 : 0;
      synthesis = await synthesizeBriefing({
        timeoutMs: synthesisTimeout,
        retries: synthesisRetries,
        deadlineAt,
        kind,
        candidates: retrieval.candidates,
        topics,
        customInterests: pref.customInterests,
        storyCount: pref.storyCount || 7,
        briefingLength: pref.briefingLength || "medium",
        majorNewsOnly: Boolean(pref.majorNewsOnly),
        includeWorthKnowing,
        feedback,
        recentlyShown: shown.headlines,
        periodLabel: periodLabel(kind, briefing.periodKey),
      });
    } catch (error) {
      const code = error instanceof AiError ? `ai_${error.code}` : "ai_api_error";
      return fail(code, error?.message || String(error));
    }

    /* 4. keep only source-backed stories */
    const grounded = groundBriefing({
      data: synthesis.data,
      candidates: retrieval.candidates,
      kind,
      storyCount: pref.storyCount || 7,
      includeWorthKnowing,
      topics,
    });
    warnings.push(...grounded.warnings);
    stats.candidatesSent = retrieval.candidates.length;
    stats.storiesDropped = grounded.dropped;
    if (grounded.dropped) log(`briefing ${briefingId}: dropped ${grounded.dropped} ungrounded items`);

    const toSource = (c) => ({
      article: c.articleId,
      url: c.url,
      title: c.title,
      publisher: c.publisher,
      publishedAt: c.publishedAt,
    });

    if (!grounded.stories.length) {
      briefing.status = "empty";
      briefing.title = titleFor(kind, briefing.periodKey, briefing.timezone, new Date());
      briefing.intro = grounded.intro;
      briefing.note =
        grounded.note ||
        "The retrieved sources were not enough to write a reliable briefing. Nothing was made up; try again later or adjust your topics.";
      briefing.completedAt = new Date();
      briefing.stats = { ...stats, model: synthesis.model, durationMs: Date.now() - startedAt, warnings };
      await briefing.save();
      return briefing;
    }

    /* 5. persist */
    await BriefingStory.insertMany(
      grounded.stories.map((s) => ({
        briefing: briefing._id,
        user: briefing.user,
        section: s.section,
        rank: s.rank,
        headline: s.headline,
        summary: s.summary,
        whyItMatters: s.whyItMatters,
        isAnalysis: s.isAnalysis,
        topics: s.topics,
        suggestedTopics: s.suggestedTopics,
        article: s.primary.articleId,
        url: s.primary.url,
        publisher: s.primary.publisher,
        publishedAt: s.primary.publishedAt,
        sources: s.sources.map(toSource),
      })),
    );

    briefing.status = "ready";
    briefing.title = titleFor(kind, briefing.periodKey, briefing.timezone, new Date());
    briefing.intro = grounded.intro;
    briefing.note = grounded.insufficient ? grounded.note || "Some of today's material was thin; treat this briefing as partial." : grounded.note;
    briefing.highlights = grounded.highlights.map((h) => ({ title: h.title, summary: h.summary, sources: h.sources.map(toSource) }));
    briefing.trends = grounded.trends.map((t) => ({ title: t.title, summary: t.summary, sources: t.sources.map(toSource) }));
    briefing.storyCount = grounded.stories.length;
    briefing.completedAt = new Date();
    briefing.stats = { ...stats, model: synthesis.model, durationMs: Date.now() - startedAt, warnings };
    await briefing.save();
    log(`briefing ${briefingId}: ready with ${grounded.stories.length} stories in ${Date.now() - startedAt} ms`);
    return briefing;
  } catch (error) {
    if (error instanceof RetrievalError) {
      return fail(`mcp_${error.code}`, error.message);
    }
    console.error("[news] unexpected generation error", error);
    return fail("internal", `Unexpected error: ${error?.message || error}`);
  }
}

/**
 * Convenience for the cron: start + run in one call, then record the cycle as
 * delivered unless it failed for a reason a later run could recover from.
 */
export async function generateNow({ userId, kind, trigger, periodKey, log, budgetMs }) {
  const briefing = await startBriefing({ userId, kind, trigger, periodKey });
  const done = await runBriefingGeneration(briefing._id, { log, budgetMs });
  if (trigger === "scheduled" && !(done?.status === "failed" && isTransientFailure(done.errorCode))) {
    await markCycleDelivered(userId, kind, briefing.periodKey);
  }
  return done;
}
