// Public MCP API for the rest of the app. Server only.
//
//   searchWeb(query, opts)   -> { ok, results, tool, server, error }
//   searchNews(query, opts)  -> { ok, results, tool, server, error }
//   fetchPage(url, opts)     -> { ok, text, title, tool, server, error }
//   getMcpStatus()           -> { configured, servers, routing, ... }
//
// When several servers are configured, each capability is routed to the one
// that serves it best: a provider with a real news tool wins news, a provider
// with page extraction wins fetching. So Brave can supply dated news while
// Tavily supplies full article text, from one briefing.
//
// None of these throw for operational failures (server down, tool error,
// timeout): they return ok:false with a coded error so callers can degrade
// gracefully and build a briefing from whatever did succeed.

import {
  getMcpConfig,
  listMcpServers,
  getMcpRouting,
  getToolOverrides,
  getExtraArgs,
  describeMcpTarget,
  isMcpConfigured,
  DEFAULT_SERVER,
} from "@/lib/mcp/config";
import { getConnection, callTool, pingServer, McpError } from "@/lib/mcp/client";
import { resolveCapabilities, buildSearchArgs, buildFetchArgs } from "@/lib/mcp/capabilities";
import { parseSearchResult, parseFetchResult, textBlocks, canonicalizeUrl } from "@/lib/mcp/normalize";

export { McpError, isMcpConfigured };

let routingCache = null; // { signature, routing }

function signature(servers) {
  return JSON.stringify(servers.map((s) => [s.name, s.transport, s.url, s.command, s.args]));
}

/** Connect to every configured server and read the tools it offers. */
async function probeServers() {
  const servers = listMcpServers();
  const overrides = getToolOverrides();

  const probes = await Promise.all(
    servers.map(async (config) => {
      try {
        const conn = await getConnection({ server: config.name });
        return {
          name: config.name,
          ok: true,
          target: describeMcpTarget(config),
          transportKind: conn.transportKind,
          info: conn.serverInfo,
          tools: conn.tools.map((t) => t.name),
          caps: resolveCapabilities(conn.tools, overrides),
          error: null,
        };
      } catch (error) {
        return {
          name: config.name,
          ok: false,
          target: describeMcpTarget(config),
          tools: [],
          caps: null,
          error: error instanceof McpError ? error.message : String(error?.message || error),
          errorCode: error instanceof McpError ? error.code : "connect_failed",
        };
      }
    }),
  );
  return probes;
}

/**
 * Decide which server answers each capability.
 *
 * An explicit MCP_ROUTE_* wins. Otherwise the best provider is chosen: for
 * news that means a dedicated news tool ahead of a topic flag ahead of
 * nothing, and ties go to the default server so a single-server setup keeps
 * behaving exactly as it did.
 */
function decideRouting(probes) {
  const pinned = getMcpRouting();
  const live = probes.filter((p) => p.ok && p.caps);
  const notes = [];

  const rank = (probe, capability) => {
    const cap = probe.caps[capability];
    if (!cap) return -1;
    let score = 1;
    if (capability === "searchNews" && cap.viaTopic === false) score += 2;
    if (capability === "searchNews" && cap.viaTopic === true) score += 1;
    if (probe.name === DEFAULT_SERVER) score += 0.5;
    return score;
  };

  const choose = (capability) => {
    const wanted = pinned[capability === "searchWeb" ? "searchWeb" : capability];
    if (wanted) {
      const hit = live.find((p) => p.name === wanted && p.caps[capability]);
      if (hit) return { server: hit.name, cap: hit.caps[capability] };
      notes.push(`Routing for ${capability} names "${wanted}", which is not available; choosing automatically.`);
    }
    let best = null;
    let bestScore = 0;
    for (const probe of live) {
      const score = rank(probe, capability);
      if (score > bestScore) {
        best = probe;
        bestScore = score;
      }
    }
    return best ? { server: best.name, cap: best.caps[capability] } : null;
  };

  const routing = {
    searchWeb: choose("searchWeb"),
    searchNews: choose("searchNews"),
    fetchPage: choose("fetchPage"),
  };

  for (const probe of probes) {
    if (!probe.ok) notes.push(`Server "${probe.name}" is unreachable: ${probe.error}`);
  }
  if (!routing.searchWeb) notes.push("No configured server exposes a web-search tool.");
  if (!routing.searchNews && routing.searchWeb) {
    notes.push("No dedicated news-search tool; news searches use web search with a recency filter.");
  }
  if (!routing.fetchPage) {
    notes.push("No page-fetch tool; briefings are built from search snippets only.");
  }
  for (const probe of live) {
    for (const n of probe.caps.notes || []) {
      if (/No dedicated news-search|No page-fetch|No web-search/.test(n)) continue; // decided globally
      notes.push(`${probe.name}: ${n}`);
    }
  }

  return { routing, probes, notes: [...new Set(notes)] };
}

async function getRouting() {
  const servers = listMcpServers();
  if (!servers.length) {
    throw new McpError(
      "No MCP server is configured. Set MCP_SERVER_URL (or MCP_SERVER_COMMAND for local development).",
      { code: "not_configured" },
    );
  }
  const sig = signature(servers);
  if (routingCache && routingCache.signature === sig) return routingCache.value;

  const value = decideRouting(await probeServers());
  routingCache = { signature: sig, value };
  return value;
}

/** Forget the cached routing, so the next call re-probes every server. */
export function resetRouting() {
  routingCache = null;
}

/**
 * Why no server can serve a capability. "Unreachable" and "connected but has
 * no such tool" need different words: the first is a transient outage the
 * caller may retry, the second is a configuration fact.
 */
function noTargetError(routed, what) {
  const live = routed.probes.filter((p) => p.ok);
  if (!live.length) {
    const first = routed.probes[0];
    return {
      code: first?.errorCode || "connect_failed",
      message: first?.error || "No MCP server could be reached.",
    };
  }
  return { code: "tool_not_found", message: `No connected MCP server exposes a ${what} tool.` };
}

function toError(error, fallbackCode = "unavailable") {
  if (error instanceof McpError) {
    return { code: error.code, message: error.message, tool: error.tool || null };
  }
  return { code: fallbackCode, message: error?.message || String(error), tool: null };
}

/**
 * A failure reported inside the payload rather than through the isError flag.
 *
 * Tavily's server, for one, answers a rejected API key with isError false and
 * a JSON body: {"error":"Search failed","status":401,"detail":{...},
 * "documentation":"https://..."}. Left undetected, the URL in that body gets
 * scraped as if it were a search hit, so an error page can end up cited as a
 * news source.
 */
function payloadError(result) {
  const payloads = [];
  const sc = result?.structuredContent;
  if (sc && typeof sc === "object" && !Array.isArray(sc)) payloads.push(sc);
  for (const text of textBlocks(result)) {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payloads.push(parsed);
    } catch {
      /* not JSON */
    }
  }

  for (const p of payloads) {
    const reported = p.error ?? p.detail?.error ?? p.errorMessage;
    if (!reported) continue;
    if (Array.isArray(p.results) && p.results.length) continue;
    const detail =
      typeof p.detail?.error === "string"
        ? p.detail.error
        : typeof reported === "string"
          ? reported
          : JSON.stringify(reported);
    const status = Number(p.status ?? p.statusCode) || null;
    return { status, message: detail.slice(0, 300) };
  }
  return null;
}

function classify(text, status) {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "auth";
  if (/rate limit|too many requests|quota|credits/i.test(text)) return "rate_limited";
  if (/unauthori[sz]ed|invalid api key|forbidden/i.test(text)) return "auth";
  return "tool_error";
}

function errorFromResult(result, tool) {
  const payload = payloadError(result);
  if (payload) {
    return {
      code: classify(payload.message, payload.status),
      message: `MCP tool "${tool}" reported an error: ${payload.message}`,
      tool,
    };
  }
  if (!result?.isError) return null;
  const text = textBlocks(result).join("\n").trim() || "tool reported an error";
  return {
    code: classify(text, null),
    message: `MCP tool "${tool}" reported an error: ${text.slice(0, 300)}`,
    tool,
  };
}

async function runSearch(kind, query, { maxResults = 10, recencyDays = 7, timeoutMs } = {}) {
  const trimmed = String(query || "").trim();
  if (!trimmed) {
    return { ok: false, results: [], tool: null, server: null, error: { code: "bad_request", message: "Empty query" } };
  }

  let routed;
  try {
    routed = await getRouting();
  } catch (error) {
    return { ok: false, results: [], tool: null, server: null, error: toError(error, "connect_failed") };
  }

  const news = kind === "news";
  const target = (news && routed.routing.searchNews) || routed.routing.searchWeb;
  if (!target) {
    return { ok: false, results: [], tool: null, server: null, error: noTargetError(routed, "search") };
  }

  const dedicatedNews = news && Boolean(routed.routing.searchNews);
  const args = buildSearchArgs(target.cap, {
    query: trimmed,
    maxResults,
    // Without a real news tool, tighten recency so web search behaves like one.
    recencyDays: news && !dedicatedNews ? Math.min(recencyDays, 7) : recencyDays,
    news: dedicatedNews,
    extra: getExtraArgs().search,
  });

  try {
    const result = await callTool(target.cap.tool, args, { timeoutMs, server: target.server });
    const failure = errorFromResult(result, target.cap.tool);
    if (failure) return { ok: false, results: [], tool: target.cap.tool, server: target.server, error: failure };
    const { items, warnings } = parseSearchResult(result);
    return { ok: true, results: items, tool: target.cap.tool, server: target.server, warnings, error: null };
  } catch (error) {
    return { ok: false, results: [], tool: target.cap.tool, server: target.server, error: toError(error) };
  }
}

export function searchWeb(query, opts) {
  return runSearch("web", query, opts);
}

export function searchNews(query, opts) {
  return runSearch("news", query, opts);
}

export async function fetchPage(url, { maxChars = 8000, timeoutMs } = {}) {
  const canon = canonicalizeUrl(url);
  if (!canon) {
    return { ok: false, text: "", title: "", tool: null, server: null, error: { code: "bad_request", message: "Invalid URL" } };
  }

  let routed;
  try {
    routed = await getRouting();
  } catch (error) {
    return { ok: false, text: "", title: "", tool: null, server: null, error: toError(error, "connect_failed") };
  }
  const target = routed.routing.fetchPage;
  if (!target) {
    return { ok: false, text: "", title: "", tool: null, server: null, error: noTargetError(routed, "page-fetch") };
  }

  const args = buildFetchArgs(target.cap, { url: canon.url, maxChars, extra: getExtraArgs().fetch });
  try {
    const result = await callTool(target.cap.tool, args, { timeoutMs, server: target.server });
    const failure = errorFromResult(result, target.cap.tool);
    if (failure) return { ok: false, text: "", title: "", tool: target.cap.tool, server: target.server, error: failure };
    const { text, title } = parseFetchResult(result, { maxChars });
    if (!text) {
      return {
        ok: false,
        text: "",
        title: "",
        tool: target.cap.tool,
        server: target.server,
        error: { code: "empty", message: "The page-fetch tool returned no text." },
      };
    }
    return { ok: true, text, title, tool: target.cap.tool, server: target.server, error: null };
  } catch (error) {
    return { ok: false, text: "", title: "", tool: target.cap.tool, server: target.server, error: toError(error) };
  }
}

/** What the settings page shows under "Connection". */
export async function getMcpStatus() {
  const servers = listMcpServers();
  if (!servers.length) {
    return {
      configured: false,
      connected: false,
      servers: [],
      routing: {},
      target: describeMcpTarget(getMcpConfig()),
      error: "No MCP server is configured.",
    };
  }

  try {
    const { routing, probes, notes } = await getRouting();
    // Some servers do not implement ping; tools/list already proved liveness.
    await Promise.all(probes.filter((p) => p.ok).map((p) => pingServer(p.name).catch(() => false)));

    const label = (entry) =>
      entry ? `${entry.cap.tool}${entry.cap.viaTopic ? " (topic=news)" : ""} via ${entry.server}` : null;

    return {
      configured: true,
      connected: probes.some((p) => p.ok),
      servers: probes.map((p) => ({
        name: p.name,
        connected: p.ok,
        target: p.target,
        transportKind: p.transportKind || null,
        info: p.info || null,
        tools: p.tools,
        error: p.error || null,
      })),
      routing: {
        searchWeb: label(routing.searchWeb),
        searchNews: label(routing.searchNews),
        fetchPage: label(routing.fetchPage),
      },
      // Kept for callers that only care about a single-server setup.
      target: probes[0]?.target || "",
      capabilities: {
        searchWeb: routing.searchWeb?.cap.tool || null,
        searchNews: routing.searchNews ? `${routing.searchNews.cap.tool}${routing.searchNews.cap.viaTopic ? " (topic=news)" : ""}` : null,
        fetchPage: routing.fetchPage?.cap.tool || null,
      },
      tools: probes.flatMap((p) => p.tools),
      notes,
      error: probes.some((p) => p.ok) ? null : probes[0]?.error || "No MCP server could be reached.",
      // Only set when nothing answered, so callers can tell "unreachable"
      // apart from "connected but missing a tool".
      errorCode: probes.some((p) => p.ok) ? null : probes[0]?.errorCode || "connect_failed",
    };
  } catch (error) {
    const e = toError(error, "connect_failed");
    return {
      configured: true,
      connected: false,
      servers: servers.map((s) => ({ name: s.name, connected: false, target: describeMcpTarget(s), tools: [], error: e.message })),
      routing: {},
      target: describeMcpTarget(getMcpConfig()),
      error: e.message,
      errorCode: e.code,
    };
  }
}
