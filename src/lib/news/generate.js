// Briefing generation: the end-to-end pipeline. Server only.
//
// A briefing run is made of editions: one per location or group of
// locations the reader set up for that kind (NewsPreference.editions), or a
// single worldwide edition when nothing is set up. Each edition is its own
// pass through the pipeline:
//
//   preferences + topics + feedback
//     -> AI plans search queries, in the edition's language, for its region
//     -> MCP runs the searches and fetches pages         (retrieval.js)
//     -> AI ranks, de-duplicates and summarises           (lib/ai)
//        in the edition's own language or translated
//     -> validator keeps only source-backed stories       (validate.js)
//     -> the edition's stories and summary are stored
//
// One edition uses most of a serverless function's 300 s, so a run with
// several editions cannot finish in one invocation. Each invocation runs one
// edition and then asks the app to start the next in a fresh invocation
// (POST /api/news/briefings/continue, authorised with CRON_SECRET). Editions
// are claimed atomically, so a duplicate hand-off never runs one twice, and a
// chain that breaks is picked up again by the dashboard or the cron.

import { timingSafeEqual } from "node:crypto";
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
import {
  MAX_EDITIONS,
  countryName,
  editionsForKind,
  isKnownCountry,
  isKnownLanguage,
  outputLanguageOf,
} from "@/lib/news/locales";

// A Vercel function lives at most 300 s, and each invocation plans inside it.
export const FUNCTION_BUDGET_MS = 300 * 1000;
// An edition "generating" with no heartbeat for this long has lost its
// function.
export const GENERATION_STALE_MS = 6 * 60 * 1000;
// Nothing has touched a run with waiting editions for this long: the hand-off
// was lost and the next edition should be started again.
export const STALL_RESUME_MS = 45 * 1000;
// A run stalled this long is given up on, so the one-run-at-a-time lock is
// released even if nobody ever resumes it.
export const ABANDON_MS = 30 * 60 * 1000;
// Below this there is not enough time to search and summarise an edition.
export const MIN_GENERATION_MS = 100 * 1000;

const defaultLog = (m) => console.log(`[news] ${m}`);

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

// Failures caused by configuration rather than by the edition: every later
// edition would fail the same way, so the rest are stopped at once instead of
// spending a search pass each to learn it.
const RUN_FATAL_CODES = new Set([
  "mcp_not_configured",
  "ai_not_configured",
  "ai_auth",
  "mcp_auth",
  "mcp_tool_not_found",
]);

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

/* ── hand-off between invocations ──────────────────────────────────── */

/**
 * True when the request carries the server's own secret: Vercel Cron, an
 * external scheduler, or one invocation handing work to the next.
 */
export function isInternalRequest(req) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  // Constant time; differing lengths are rejected before timingSafeEqual,
  // which would otherwise throw on them.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * How an invocation hands the next edition to a fresh invocation, or null
 * when it cannot (no CRON_SECRET). Without one, editions run back to back
 * for as long as the function's time allows and the rest are resumed later.
 */
export function continuationChain(req) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return null;
  try {
    return { origin: new URL(req.url).origin, secret };
  } catch {
    return null;
  }
}

/** Ask the app to run the next edition of a briefing in a new invocation. */
export async function triggerContinuation(briefingId, chain, log = defaultLog) {
  if (!chain?.origin || !chain?.secret) return false;
  try {
    const res = await fetch(`${chain.origin}/api/news/briefings/continue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chain.secret}`,
      },
      body: JSON.stringify({ id: String(briefingId) }),
      // The continue route answers 202 at once and works after responding.
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) log(`hand-off for briefing ${briefingId} was refused (HTTP ${res.status})`);
    return res.ok;
  } catch (error) {
    log(`hand-off for briefing ${briefingId} failed: ${error?.message || error}`);
    return false;
  }
}

/* ── editions ──────────────────────────────────────────────────────── */

/**
 * The editions a run of this kind builds, snapshotted from the reader's
 * preferences: those of their editions that run in this kind. None means one
 * worldwide edition covering the reader's topics, which is exactly what a
 * briefing was before editions.
 */
export function resolveEditions(pref, kind) {
  const configured = editionsForKind(pref?.editions, kind);
  const userLanguage = isKnownLanguage(pref?.language) ? pref.language : "en";
  const list = configured.length
    ? configured
    : [{ key: "main", countries: [], language: "", output: "source", coverage: "topics" }];

  const seen = new Set();
  return list.slice(0, MAX_EDITIONS).map((raw, index) => {
    let key = String(raw.key || `edition-${index + 1}`).slice(0, 40);
    for (let n = 1; seen.has(key); n += 1) key = `${String(raw.key).slice(0, 30)}-${index}-${n}`;
    seen.add(key);
    const language = isKnownLanguage(raw.language) ? String(raw.language).toLowerCase() : "";
    return {
      key,
      countries: [...new Set((raw.countries || []).map((c) => String(c).toUpperCase()))].filter(isKnownCountry),
      language,
      outputLanguage: outputLanguageOf({ language, output: raw.output }, userLanguage),
      coverage: raw.coverage === "top" ? "top" : "topics",
      status: "pending",
    };
  });
}

function plainList(list) {
  return (list || []).map((item) => (item && typeof item.toObject === "function" ? item.toObject() : item));
}

const STAT_KEYS = [
  "queries",
  "searchesOk",
  "searchesFailed",
  "resultsRetrieved",
  "uniqueArticles",
  "pagesFetched",
  "candidatesSent",
  "storiesDropped",
  "durationMs",
];

/** One stats object for a whole run, summed from its editions. */
function aggregateStats(editions) {
  const out = { model: "", mcpServer: "", warnings: [] };
  for (const key of STAT_KEYS) out[key] = 0;
  const servers = new Set();
  const warnings = new Set();
  for (const edition of editions) {
    const stats = edition.stats || {};
    for (const key of STAT_KEYS) out[key] += Number(stats[key]) || 0;
    if (!out.model && stats.model) out.model = stats.model;
    for (const tool of String(stats.mcpServer || "").split(",")) {
      if (tool.trim()) servers.add(tool.trim());
    }
    for (const warning of stats.warnings || []) warnings.add(warning);
  }
  out.mcpServer = [...servers].join(", ");
  out.warnings = [...warnings];
  return out;
}

/**
 * Close a run whose editions have all finished. Ready when any edition
 * produced stories, empty when none did but some came back empty, failed
 * only when every edition failed. A single-edition run also keeps its
 * content at the top level, so history and older screens read naturally.
 */
function finalize(briefing) {
  const editions = briefing.editions || [];
  const ready = editions.filter((e) => e.status === "ready");
  const empty = editions.filter((e) => e.status === "empty");
  const failed = editions.filter((e) => e.status === "failed");

  briefing.storyCount = editions.reduce((n, e) => n + (e.storyCount || 0), 0);
  briefing.status = ready.length ? "ready" : empty.length ? "empty" : "failed";
  briefing.error =
    briefing.status === "failed" ? failed[0]?.error || "The briefing could not be generated." : "";
  briefing.errorCode = briefing.status === "failed" ? failed[0]?.errorCode || "internal" : "";

  if (editions.length === 1) {
    const only = editions[0];
    briefing.intro = only.intro || "";
    briefing.note = only.note || "";
    briefing.highlights = plainList(only.highlights);
    briefing.trends = plainList(only.trends);
  } else {
    briefing.note = briefing.status === "empty" ? empty[0]?.note || "" : "";
  }
  briefing.stats = aggregateStats(editions);
  briefing.completedAt = new Date();
  return briefing;
}

/**
 * Deal with runs that lost their function. An edition stuck "generating"
 * past the stale window becomes a timeout; a run with editions still waiting
 * stays open so it can be resumed, unless it has been abandoned for so long
 * that holding the lock would only block the reader.
 */
export async function markStaleBriefings(userId) {
  const now = Date.now();
  const cutoff = new Date(now - GENERATION_STALE_MS);
  const filter = {
    status: "generating",
    $or: [{ heartbeatAt: { $lt: cutoff } }, { heartbeatAt: null, startedAt: { $lt: cutoff } }],
  };
  if (userId) filter.user = userId;

  const stalled = await Briefing.find(filter);
  for (const briefing of stalled) {
    const editions = briefing.editions || [];

    // A briefing from before editions existed.
    if (!editions.length) {
      briefing.status = "failed";
      briefing.error = "Generation did not finish in time. Try again.";
      briefing.errorCode = "timeout";
      briefing.completedAt = new Date();
      await briefing.save();
      continue;
    }

    for (const edition of editions) {
      if (edition.status === "generating") {
        edition.status = "failed";
        edition.error = "This edition did not finish in time.";
        edition.errorCode = "timeout";
        edition.completedAt = new Date();
      }
    }
    const beat = new Date(briefing.heartbeatAt || briefing.startedAt || 0).getTime();
    if (now - beat > ABANDON_MS) {
      for (const edition of editions) {
        if (edition.status === "pending") {
          edition.status = "failed";
          edition.error = "Skipped because the run stopped before reaching it.";
          edition.errorCode = "timeout";
          edition.completedAt = new Date();
        }
      }
    }
    if (!editions.some((e) => e.status === "pending" || e.status === "generating")) {
      finalize(briefing);
    }
    briefing.markModified("editions");
    await briefing.save();
  }
}

/**
 * Runs with editions still waiting and nothing working on them, whose last
 * heartbeat is old enough that the hand-off was clearly lost.
 */
export async function findResumableBriefings({ limit = 20 } = {}) {
  await connectToDB();
  await markStaleBriefings();
  const quiet = new Date(Date.now() - STALL_RESUME_MS);
  return Briefing.find({
    status: "generating",
    heartbeatAt: { $lt: quiet },
    $and: [
      { editions: { $elemMatch: { status: "pending" } } },
      { editions: { $not: { $elemMatch: { status: "generating" } } } },
    ],
  })
    .select({ _id: 1, user: 1 })
    .sort({ heartbeatAt: 1 })
    .limit(limit)
    .lean();
}

/* ── starting a run ────────────────────────────────────────────────── */

function titleFor(kind, periodKey, timezone, at) {
  if (kind === "weekly") return "Your week in review";
  if (kind === "monthly") return "Your month in review";
  return `${greetingFor(at, timezone)}.`;
}

/**
 * Create the Briefing row with one pending edition per configured location.
 * Throws GenerationError when a run is already in progress.
 * @param {{ userId: string, kind: "daily"|"weekly"|"monthly"|"custom",
 *   trigger: "manual"|"scheduled", periodKey?: string, editionKeys?: string[] }} params
 *   editionKeys: build only these editions of the kind (the reader asked for
 *   one region rather than the whole run). Empty or absent means all of them.
 */
export async function startBriefing({ userId, kind, trigger = "manual", periodKey, editionKeys = null }) {
  await connectToDB();
  await markStaleBriefings(userId);

  const running = await Briefing.findOne({ user: userId, status: "generating" }).sort({ startedAt: -1 });
  if (running) {
    throw new GenerationError("A briefing is already being generated.", "already_running", 409);
  }

  const { pref } = await getOrCreatePreferences(userId);
  const timezone = safeTimeZone(pref.timezone || "UTC");
  const key = periodKey || currentPeriodKey(new Date(), timezone);
  const now = new Date();

  let editions = resolveEditions(pref, kind);
  if (editionKeys?.length) {
    const wanted = new Set(editionKeys.map(String));
    editions = editions.filter((e) => wanted.has(e.key));
    if (!editions.length) {
      throw new GenerationError("Those editions are not part of this briefing.", "unknown_edition", 400);
    }
  }

  try {
    return await Briefing.create({
      user: userId,
      kind,
      trigger,
      periodKey: key,
      timezone,
      status: "generating",
      title: titleFor(kind, key, timezone, now),
      editions,
      startedAt: now,
      heartbeatAt: now,
    });
  } catch (error) {
    // A partial unique index on (user, status="generating") makes the check
    // above atomic: two requests that raced both get here, only one wins.
    if (error?.code === 11000) {
      throw new GenerationError("A briefing is already being generated.", "already_running", 409);
    }
    throw error;
  }
}

/** Record that a scheduled cycle is finished and should not run again. */
export async function markCycleDelivered(userId, kind, periodKey) {
  await NewsPreference.updateOne(
    { user: userId },
    { $set: { [`lastScheduled.${kind}`]: periodKey } },
  );
}

/* ── one edition ───────────────────────────────────────────────────── */

function fallbackQueries({ topics, kind, includeWorthKnowing, countries = [], coverage = "topics", maxQueries }) {
  const meta = kindMeta(kind);
  const period = { day: "today", week: "this week", month: "this month" }[meta.window] || "today";
  const places = countries.map(countryName).filter(Boolean);
  const queries = [];

  if (coverage === "top") {
    for (const place of places.length ? places : ["world"]) {
      queries.push({ query: `${place} news ${period}`, topic: "broad", purpose: "broad" });
      queries.push({ query: `${place} politics economy ${period}`, topic: "broad", purpose: "broad" });
    }
    return queries.slice(0, maxQueries);
  }

  const where = places.length ? ` ${places.join(" ")}` : "";
  for (const t of topics) {
    queries.push({ query: `${t}${where}`, topic: t, purpose: "topic" });
    if (meta.window !== "day") queries.push({ query: `${t}${where} ${period}`, topic: t, purpose: "topic" });
  }
  if (includeWorthKnowing) {
    queries.push({ query: `top news${where} ${period}`, topic: "broad", purpose: "broad" });
    queries.push({ query: `major technology news${where} ${period}`, topic: "broad", purpose: "broad" });
  }
  return queries.slice(0, maxQueries);
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

/**
 * The topics followed in one edition: those limited to it, plus every topic
 * that is not limited to any edition. The implicit worldwide edition of a
 * reader with no editions configured follows all of them, so scoping a topic
 * never leaves that briefing with nothing to search for.
 */
export function topicsForEdition(topicDocs, editionKey) {
  const all = !editionKey || editionKey === "main";
  return (topicDocs || [])
    .filter((t) => all || !t.editions?.length || t.editions.includes(editionKey))
    .map((t) => t.name);
}

/** What every edition of a run shares, loaded once per invocation. */
async function loadRunContext(briefing) {
  const { pref } = await getOrCreatePreferences(briefing.user);
  const topicDocs = await listTopics(briefing.user);
  const feedback = await NewsFeedback.find({ user: briefing.user }).sort({ updatedAt: -1 }).limit(60).lean();
  const shown = await recentlyShown(briefing.user, briefing.kind, briefing._id);
  return { pref, topicDocs, feedback, shown };
}

/**
 * Update one edition in place. A positional update touches only that entry,
 * so two invocations finishing different editions never overwrite each other.
 */
async function saveEdition(briefingId, key, patch) {
  const set = { heartbeatAt: new Date() };
  for (const [field, value] of Object.entries(patch)) set[`editions.$.${field}`] = value;
  await Briefing.updateOne({ _id: briefingId, "editions.key": key }, { $set: set });
}

/** Fail every edition still waiting, with the reason the run cannot go on. */
async function failRemaining(briefingId, code, message) {
  const now = new Date();
  await Briefing.updateOne(
    { _id: briefingId },
    {
      $set: {
        "editions.$[waiting].status": "failed",
        "editions.$[waiting].error": message,
        "editions.$[waiting].errorCode": code,
        "editions.$[waiting].completedAt": now,
        heartbeatAt: now,
      },
    },
    { arrayFilters: [{ "waiting.status": "pending" }] },
  );
}

/**
 * Claim the next waiting edition. The update only matches while that
 * edition is still pending, so of two invocations racing for it exactly one
 * gets it; the loser moves on to the edition after.
 */
async function claimNextEdition(briefingId) {
  for (let attempt = 0; attempt <= MAX_EDITIONS; attempt += 1) {
    const current = await Briefing.findById(briefingId).select({ status: 1, editions: 1 }).lean();
    if (!current || current.status !== "generating") return null;
    const next = (current.editions || []).find((e) => e.status === "pending");
    if (!next) return null;
    const now = new Date();
    const claimed = await Briefing.findOneAndUpdate(
      { _id: briefingId, status: "generating", editions: { $elemMatch: { key: next.key, status: "pending" } } },
      { $set: { "editions.$.status": "generating", "editions.$.startedAt": now, heartbeatAt: now } },
      { new: true },
    );
    if (claimed) return { briefing: claimed, key: next.key };
  }
  return null;
}

/** Build one edition. Never throws: every failure is recorded on it. */
async function runEdition(briefing, key, { pref, topicDocs, feedback, shown, log, deadlineAt, editionCount }) {
  const startedAt = Date.now();
  const edition = briefing.editions.find((e) => e.key === key);
  // Topics can be followed in every edition or only in some of them.
  const topics = topicsForEdition(topicDocs, key);
  const kind = briefing.kind;
  const tag = editionCount > 1 ? `briefing ${briefing._id} [${key}]` : `briefing ${briefing._id}`;
  const countries = [...(edition.countries || [])];
  const language = edition.language || "";
  const outputLanguage = edition.outputLanguage || "en";
  const coverage = edition.coverage === "top" ? "top" : "topics";
  // "Worth knowing" means news outside the reader's topics; an edition that
  // already covers a region's top news has nothing to add there.
  const includeWorthKnowing = coverage === "topics" && pref.includeWorthKnowing !== false;
  const remaining = () => deadlineAt - Date.now();
  const warnings = [];
  const stats = {};

  const fail = async (code, detail) => {
    // The detail goes to the server log; the reader sees a safe sentence.
    log(`${tag} failed: ${code} ${detail}`);
    await saveEdition(briefing._id, key, {
      status: "failed",
      error: safeMessage(code, detail),
      errorCode: code,
      completedAt: new Date(),
      stats: { ...stats, durationMs: Date.now() - startedAt, warnings },
    });
    return { status: "failed", errorCode: code };
  };

  try {
    if (!isMcpConfigured()) {
      return fail("mcp_not_configured", "No MCP server is configured. Set MCP_SERVER_URL on the server.");
    }
    if (!isOpenAiConfigured()) {
      return fail("ai_not_configured", "OPENAI_API_KEY is not set on the server.");
    }
    if (coverage === "topics" && !topics.length && !includeWorthKnowing && !pref.customInterests?.trim()) {
      return fail("no_topics", "Add at least one topic (or enable “Worth knowing”) before generating a briefing.");
    }

    /* 1. plan queries */
    const maxQueries = maxQueriesFor(kind, editionCount);
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
        maxQueries,
        timeoutMs: 30000,
        retries: 1,
        deadlineAt,
        language,
        countries,
        coverage,
      });
      queries = plan.queries;
      plannerModel = plan.model;
    } catch (error) {
      log(`${tag} query planning failed (${error?.code || "error"}): ${error?.message}`);
      // A rejected or missing key will fail the summarising step too, so stop
      // now rather than spending the whole retrieval budget first.
      if (error instanceof AiError && ["auth", "not_configured"].includes(error.code)) {
        return fail(`ai_${error.code}`, error.message);
      }
      warnings.push("Search planning fell back to simple queries.");
    }
    if (!queries.length) {
      queries = fallbackQueries({ topics, kind, includeWorthKnowing, countries, coverage, maxQueries });
    }
    if (!queries.length) {
      return fail("no_topics", "Nothing to search for. Add a topic or describe your interests.");
    }
    log(`${tag}: ${queries.length} queries`);

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
      countries,
      language,
    });
    Object.assign(stats, retrieval.stats, { mcpServer: retrieval.stats.tools.join(", ") });
    delete stats.tools;
    warnings.push(...retrieval.warnings);
    log(`${tag}: ${retrieval.candidates.length} candidates, ${stats.pagesFetched} pages fetched`);

    if (!retrieval.candidates.length) {
      await saveEdition(briefing._id, key, {
        status: "empty",
        note:
          coverage === "top"
            ? "No recent news was retrieved for this region. Try again later."
            : "No recent, relevant results were retrieved for your topics. Try broader topics or generate again later.",
        storyCount: 0,
        completedAt: new Date(),
        stats: { ...stats, model: plannerModel, durationMs: Date.now() - startedAt, warnings },
      });
      return { status: "empty" };
    }

    /* 3. synthesise with the AI */
    let synthesis;
    try {
      const left = remaining();
      synthesis = await synthesizeBriefing({
        timeoutMs: Math.max(20000, Math.min(120000, left - 8000)),
        retries: left > 250000 ? 2 : left > 130000 ? 1 : 0,
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
        outputLanguage,
        sourceLanguage: language,
        countries,
        coverage,
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
    if (grounded.dropped) log(`${tag}: dropped ${grounded.dropped} ungrounded items`);

    const toSource = (c) => ({
      article: c.articleId,
      url: c.url,
      title: c.title,
      publisher: c.publisher,
      publishedAt: c.publishedAt,
    });

    if (!grounded.stories.length) {
      await saveEdition(briefing._id, key, {
        status: "empty",
        intro: grounded.intro,
        note:
          grounded.note ||
          "The retrieved sources were not enough to write a reliable briefing. Nothing was made up; try again later.",
        storyCount: 0,
        completedAt: new Date(),
        stats: { ...stats, model: synthesis.model, durationMs: Date.now() - startedAt, warnings },
      });
      return { status: "empty" };
    }

    /* 5. persist */
    await BriefingStory.insertMany(
      grounded.stories.map((s) => ({
        briefing: briefing._id,
        user: briefing.user,
        edition: key,
        language,
        outputLanguage,
        countries,
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

    await saveEdition(briefing._id, key, {
      status: "ready",
      intro: grounded.intro,
      note: grounded.insufficient
        ? grounded.note || "Some of the material was thin; treat this edition as partial."
        : grounded.note,
      highlights: grounded.highlights.map((h) => ({ title: h.title, summary: h.summary, sources: h.sources.map(toSource) })),
      trends: grounded.trends.map((t) => ({ title: t.title, summary: t.summary, sources: t.sources.map(toSource) })),
      storyCount: grounded.stories.length,
      error: "",
      errorCode: "",
      completedAt: new Date(),
      stats: { ...stats, model: synthesis.model, durationMs: Date.now() - startedAt, warnings },
    });
    log(`${tag}: ready with ${grounded.stories.length} stories in ${Date.now() - startedAt} ms`);
    return { status: "ready" };
  } catch (error) {
    if (error instanceof RetrievalError) {
      return fail(`mcp_${error.code}`, error.message);
    }
    console.error("[news] unexpected generation error", error);
    return fail("internal", `Unexpected error: ${error?.message || error}`);
  }
}

/* ── driving a run ─────────────────────────────────────────────────── */

/**
 * Run the next waiting edition of a briefing. With a hand-off chain it runs
 * exactly one and passes the rest on; without one it keeps going while an
 * edition still fits in the time left. Closes the run once nothing is left.
 * Never throws for operational failures.
 */
export async function runNextEdition(briefingId, { log = defaultLog, budgetMs, chain = null } = {}) {
  await connectToDB();
  const startedAt = Date.now();
  const budget = Math.max(MIN_GENERATION_MS, Math.min(budgetMs || FUNCTION_BUDGET_MS, FUNCTION_BUDGET_MS));
  const hardStop = startedAt + budget - 25000;

  let context = null;
  let ran = 0;
  for (let guard = 0; guard <= MAX_EDITIONS; guard += 1) {
    if (ran > 0 && (chain || hardStop - Date.now() < MIN_GENERATION_MS)) break;
    const claim = await claimNextEdition(briefingId);
    if (!claim) break;
    if (!context) context = await loadRunContext(claim.briefing);

    const outcome = await runEdition(claim.briefing, claim.key, {
      ...context,
      log,
      deadlineAt: hardStop,
      editionCount: claim.briefing.editions.length,
    });
    ran += 1;

    if (outcome?.status === "failed" && RUN_FATAL_CODES.has(outcome.errorCode)) {
      await failRemaining(briefingId, outcome.errorCode, safeMessage(outcome.errorCode));
    }
  }

  const current = await Briefing.findById(briefingId);
  if (!current) return null;
  const editions = current.editions || [];
  const waiting = editions.some((e) => e.status === "pending");
  const working = editions.some((e) => e.status === "generating");

  if (current.status === "generating" && editions.length && !waiting && !working) {
    finalize(current);
    current.markModified("editions");
    await current.save();
    // A scheduled run finishes in whichever invocation ran its last edition,
    // so the cycle is recorded here rather than by whoever started it.
    if (current.trigger === "scheduled" && !(current.status === "failed" && isTransientFailure(current.errorCode))) {
      await markCycleDelivered(current.user, current.kind, current.periodKey);
    }
    return current;
  }
  if (current.status === "generating" && waiting && chain) {
    await triggerContinuation(briefingId, chain, log);
  }
  return current;
}

/**
 * Run a briefing to completion inside the current invocation, as far as its
 * time allows. Used where no hand-off is available (tests, a scheduler
 * without a secret); the website uses runNextEdition with a chain.
 */
export async function runBriefingGeneration(briefingId, { log = defaultLog, budgetMs } = {}) {
  return runNextEdition(briefingId, { log, budgetMs, chain: null });
}

/**
 * Start and run a briefing, then record a scheduled cycle as delivered
 * unless it failed for a reason a later run could recover from.
 */
export async function generateNow({ userId, kind, trigger, periodKey, log = defaultLog, budgetMs, chain = null }) {
  const briefing = await startBriefing({ userId, kind, trigger, periodKey });
  const done = await runNextEdition(briefing._id, { log, budgetMs, chain });
  if (trigger === "scheduled" && !(done?.status === "failed" && isTransientFailure(done.errorCode))) {
    await markCycleDelivered(userId, kind, briefing.periodKey);
  }
  return done;
}
