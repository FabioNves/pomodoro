// Usage tracking. Server only.
//
// Two kinds of record feed the admin Usage tab:
//   - requests: every API call that carried a user's identity, tagged with
//     the feature behind its path (recordRequest, called by the auth helpers);
//   - external calls: OpenAI completions and MCP tool calls, with token
//     counts and an estimated cost (recordExternalCall, called by the
//     wrappers in src/lib/ai/openai.js and src/lib/mcp/client.js).
//
// Writes never block a response: they are queued with next/server's after()
// where a request scope exists, and simply fired otherwise. A failure is
// logged and forgotten; metrics must never break a feature.
//
// External calls are attributed to a user through an AsyncLocalStorage
// context that the auth helpers enter for the request, and that the news
// generator enters for the briefing it is building.

import { AsyncLocalStorage } from "node:async_hooks";
import { connectToDB } from "@/lib/db";
import UsageEvent from "@/models/UsageEvent";
import { featureForPath } from "@/lib/access/features";

const usageContext = new AsyncLocalStorage();

/** Run fn with every external call inside attributed to this user/feature. */
export function withUsageContext(context, fn) {
  return usageContext.run({ ...(usageContext.getStore() || {}), ...context }, fn);
}

/** Attribute the rest of the current request to this user/feature. */
export function enterUsageContext(context) {
  try {
    usageContext.enterWith({ ...(usageContext.getStore() || {}), ...context });
  } catch {
    // Not inside an async context (should not happen in a route handler).
  }
}

export function currentUsageContext() {
  return usageContext.getStore() || {};
}

async function deferred(task) {
  try {
    const { after } = await import("next/server");
    after(task);
  } catch {
    task().catch(() => {});
  }
}

async function insert(doc) {
  try {
    await connectToDB();
    await UsageEvent.create(doc);
  } catch (error) {
    console.warn("[usage] could not record event:", error?.message || error);
  }
}

/**
 * Request-level tracking writes one row per API call, which is what the
 * per-day and per-feature charts are made of. Set USAGE_TRACK_REQUESTS=off
 * to stop those writes on a busy deployment; external calls (the ones that
 * cost money) are always recorded.
 */
function requestTrackingEnabled() {
  return (process.env.USAGE_TRACK_REQUESTS || "").trim().toLowerCase() !== "off";
}

/**
 * Count one API request. Called once the caller's identity is known.
 * @param {Request} req
 * @param {string|null} userId
 * @param {{ feature?: string|null }} [opts]
 */
export function recordRequest(req, userId, { feature } = {}) {
  if (!requestTrackingEnabled()) return;
  let path = "";
  try {
    path = new URL(req.url).pathname;
  } catch {
    path = "";
  }
  const method = (req.method || "GET").toUpperCase();
  const doc = {
    user: userId || null,
    kind: method === "GET" || method === "HEAD" ? "request" : "action",
    feature: feature || featureForPath(path) || "other",
    method,
    path: path.slice(0, 200),
    at: new Date(),
  };
  deferred(() => insert(doc));
}

// Prices in USD per million tokens, input then output. Unknown models cost
// nothing rather than something made up; OPENAI_PRICE_PER_M="in,out"
// overrides the table for whatever model is configured.
const OPENAI_PRICES = [
  [/^gpt-5-nano/, 0.05, 0.4],
  [/^gpt-5-mini/, 0.25, 2],
  [/^gpt-5/, 1.25, 10],
  [/^gpt-4\.1-nano/, 0.1, 0.4],
  [/^gpt-4\.1-mini/, 0.4, 1.6],
  [/^gpt-4\.1/, 2, 8],
  [/^gpt-4o-mini/, 0.15, 0.6],
  [/^gpt-4o/, 2.5, 10],
  [/^o4-mini/, 1.1, 4.4],
  [/^o3-mini/, 1.1, 4.4],
  [/^o3/, 2, 8],
];

export function estimateOpenAiCost(model, usage) {
  const tokensIn = Number(usage?.prompt_tokens) || 0;
  const tokensOut = Number(usage?.completion_tokens) || 0;
  let priceIn = 0;
  let priceOut = 0;
  const override = (process.env.OPENAI_PRICE_PER_M || "").split(",").map((v) => Number(v.trim()));
  if (override.length === 2 && override.every((n) => Number.isFinite(n) && n >= 0)) {
    [priceIn, priceOut] = override;
  } else {
    const row = OPENAI_PRICES.find(([re]) => re.test(model || ""));
    if (row) [, priceIn, priceOut] = row;
  }
  const cost = (tokensIn * priceIn + tokensOut * priceOut) / 1e6;
  return { tokensIn, tokensOut, cost: Math.round(cost * 1e6) / 1e6 };
}

/** Per-call price for MCP tools; MCP_COST_PER_CALL="0.008" for Tavily-like plans. */
function mcpCostPerCall() {
  const n = Number(process.env.MCP_COST_PER_CALL);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Count one call to a provider.
 * @param {{ provider: "openai"|"mcp", model?: string, usage?: object, ok?: boolean, feature?: string, userId?: string }} call
 */
export function recordExternalCall({ provider, model = "", usage = null, ok = true, feature, userId }) {
  const ctx = currentUsageContext();
  const doc = {
    user: userId || ctx.userId || null,
    kind: "external",
    feature: feature || ctx.feature || "other",
    provider,
    model: String(model || "").slice(0, 80),
    calls: 1,
    ok,
    at: new Date(),
  };
  if (provider === "openai") {
    Object.assign(doc, estimateOpenAiCost(model, usage));
  } else if (provider === "mcp") {
    doc.cost = mcpCostPerCall();
  }
  deferred(() => insert(doc));
}
