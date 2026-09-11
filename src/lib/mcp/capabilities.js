// Maps the abstract capabilities the app needs (search the web, search news,
// fetch a page) onto whatever tools the connected MCP server actually
// exposes, and builds tool arguments from each tool's input schema.
//
// Resolution order per capability:
//   1. MCP_TOOL_* override from the environment
//   2. well-known tool names of popular search servers
//   3. a heuristic on the tool name
// "search news" additionally accepts a web-search tool whose schema has a
// `topic` parameter with a "news" value (Tavily), and otherwise falls back
// to web search with a recency filter (handled in index.js).

export const CAPABILITY_NAMES = ["searchWeb", "searchNews", "fetchPage"];

const KNOWN = {
  searchWeb: [
    /^tavily[-_]search$/i,
    /^brave_web_search$/i,
    /^web_search_exa$/i,
    /^exa_search$/i,
    /^(web_search|search_web|websearch|search)$/i,
    /^duckduckgo_(web_)?search$/i,
    /^(google|serper|serp|bing|kagi|jina|perplexity|firecrawl|linkup)[-_]?(web[-_]?)?search$/i,
  ],
  searchNews: [
    /^brave_news_search$/i,
    /^(news_search|search_news|newssearch|google_news_search|serper_news)$/i,
    /^tavily[-_]news/i,
  ],
  fetchPage: [
    /^tavily[-_]extract$/i,
    /^crawling_exa$/i,
    /^(fetch|fetch_url|fetch_page|fetch_webpage|fetch_html|fetch_markdown|fetch_txt|web_fetch|webfetch|url_fetch)$/i,
    /^(read_url|read_page|get_page|get_url|scrape|scrape_url|firecrawl_scrape|extract|extract_content|browse|jina_reader|reader)$/i,
  ],
};

const EXCLUDE_FROM_WEB_SEARCH = /image|video|local|places?|map|crawl|research|summar|answer|similar|code|repo/i;

function schemaProps(tool) {
  const schema = tool?.inputSchema || tool?.input_schema || {};
  return {
    schema,
    props: (schema && schema.properties) || {},
    required: Array.isArray(schema?.required) ? schema.required : [],
  };
}

function describe(tool) {
  const { schema, props, required } = schemaProps(tool);
  return { tool: tool.name, description: tool.description || "", schema, props, required };
}

function findByPatterns(tools, patterns) {
  for (const pattern of patterns) {
    const hit = tools.find((t) => pattern.test(t.name));
    if (hit) return hit;
  }
  return null;
}

function hasNewsTopic(tool) {
  const { props } = schemaProps(tool);
  return enumOf(props.topic || props.category)
    .map((v) => v.toLowerCase())
    .includes("news");
}

export function resolveCapabilities(tools, overrides = {}) {
  const notes = [];
  const resolved = { searchWeb: null, searchNews: null, fetchPage: null };

  const pick = (capability, extraHeuristic) => {
    const override = overrides[capability];
    if (override) {
      const hit = tools.find((t) => t.name === override);
      if (hit) return describe(hit);
      notes.push(
        `MCP_TOOL_${capability.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}="${override}" is not exposed by the server; falling back to auto-detection.`,
      );
    }
    const known = findByPatterns(tools, KNOWN[capability]);
    if (known) return describe(known);
    const heuristic = extraHeuristic ? tools.find(extraHeuristic) : null;
    return heuristic ? describe(heuristic) : null;
  };

  resolved.searchWeb = pick(
    "searchWeb",
    (t) => /search/i.test(t.name) && !EXCLUDE_FROM_WEB_SEARCH.test(t.name) && !/news/i.test(t.name),
  );

  const news = pick("searchNews", (t) => /news/i.test(t.name) && /search|news/i.test(t.name));
  if (news) {
    resolved.searchNews = { ...news, viaTopic: false };
  } else if (resolved.searchWeb && hasNewsTopic({ inputSchema: resolved.searchWeb.schema })) {
    resolved.searchNews = { ...resolved.searchWeb, viaTopic: true };
  } else if (resolved.searchWeb) {
    notes.push(
      "No dedicated news-search tool; news searches use web search with a recency filter.",
    );
  }

  resolved.fetchPage = pick(
    "fetchPage",
    (t) => /fetch|extract|read|scrape|browse|content/i.test(t.name) && !/search|map|crawl/i.test(t.name),
  );
  if (!resolved.fetchPage) {
    notes.push(
      "No page-fetch tool; briefings are built from search snippets only.",
    );
  }
  if (!resolved.searchWeb) {
    notes.push("No web-search tool found on the MCP server.");
  }

  return { ...resolved, notes };
}

/* ── argument builders ─────────────────────────────────────────────── */

const QUERY_KEYS = ["query", "q", "search_query", "searchQuery", "keywords", "search_term", "term", "text", "input"];
const COUNT_KEYS = ["max_results", "maxResults", "num_results", "numResults", "count", "limit", "n", "max_count", "results", "top_k", "topK"];

function firstKey(props, keys) {
  return keys.find((k) => Object.prototype.hasOwnProperty.call(props, k)) || null;
}

function clampToSchema(prop, value) {
  let v = value;
  if (typeof prop?.minimum === "number") v = Math.max(prop.minimum, v);
  if (typeof prop?.maximum === "number") v = Math.min(prop.maximum, v);
  return v;
}

/**
 * The values a schema field will accept. Servers express a closed set as
 * `enum`, as a single `const` (Tavily's `topic` is `{const: "general"}`), or
 * as an `anyOf` of either alongside a null branch.
 */
function enumOf(prop) {
  if (!prop) return [];
  if (prop.const !== undefined) return [String(prop.const)];
  if (Array.isArray(prop.enum)) return prop.enum.map(String);
  if (Array.isArray(prop.anyOf)) {
    return prop.anyOf.flatMap((x) =>
      x?.const !== undefined ? [String(x.const)] : (x?.enum || []).map(String),
    );
  }
  return [];
}

function pickEnum(prop, candidates) {
  const values = enumOf(prop);
  if (!values.length) return candidates[0];
  return candidates.find((c) => values.includes(c)) ?? null;
}

function isoDate(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * Arguments for a search call.
 * @param {ReturnType<typeof resolveCapabilities>["searchWeb"]} cap
 */
export function buildSearchArgs(cap, { query, maxResults = 10, recencyDays = 7, news = false, extra = {} }) {
  const props = cap.props || {};
  const args = {};

  const queryKey =
    firstKey(props, QUERY_KEYS) ||
    (cap.required || []).find((k) => props[k]?.type === "string") ||
    "query";
  args[queryKey] = query;

  const countKey = firstKey(props, COUNT_KEYS);
  if (countKey) args[countKey] = clampToSchema(props[countKey], Math.round(maxResults));

  // Recency. Prefer explicit range enums; fall back to day counts / dates.
  const days = Math.max(1, Math.round(recencyDays));
  if (props.time_range) {
    const wanted = days <= 1 ? "day" : days <= 7 ? "week" : days <= 31 ? "month" : "year";
    const value = pickEnum(props.time_range, [wanted, wanted[0]]);
    if (value) args.time_range = value;
  } else if (props.freshness) {
    // Brave: pd / pw / pm / py or a "YYYY-MM-DDtoYYYY-MM-DD" range.
    const wanted = days <= 1 ? "pd" : days <= 7 ? "pw" : days <= 31 ? "pm" : "py";
    const value = pickEnum(props.freshness, [wanted]);
    if (value) args.freshness = value;
    else args.freshness = `${isoDate(days)}to${isoDate(0)}`;
  } else if (props.days && (props.days.type === "number" || props.days.type === "integer")) {
    args.days = clampToSchema(props.days, days);
  } else if (props.start_date) {
    args.start_date = isoDate(days);
  } else if (props.startPublishedDate) {
    args.startPublishedDate = new Date(Date.now() - days * 86400000).toISOString();
  } else if (props.date_range || props.dateRange) {
    const key = props.date_range ? "date_range" : "dateRange";
    const value = pickEnum(props[key], [days <= 1 ? "day" : days <= 7 ? "week" : "month"]);
    if (value) args[key] = value;
  }

  if (news && cap.viaTopic) {
    const topicKey = props.topic ? "topic" : props.category ? "category" : null;
    if (topicKey) args[topicKey] = "news";
  }

  // Keep responses small: the app fetches full pages separately.
  if (props.include_raw_content) args.include_raw_content = false;
  if (props.include_answer) args.include_answer = false;
  if (props.include_images) args.include_images = false;
  if (props.search_depth) {
    const value = pickEnum(props.search_depth, ["basic", "standard", "fast"]);
    if (value) args.search_depth = value;
  }
  if (props.type && enumOf(props.type).includes("auto")) args.type = "auto";

  return { ...args, ...extra };
}

/** Arguments for a page-fetch call. */
export function buildFetchArgs(cap, { url, maxChars = 8000, extra = {} }) {
  const props = cap.props || {};
  const args = {};

  if (props.urls) args.urls = [url];
  else if (props.url) args.url = url;
  else if (props.uri) args.uri = url;
  else if (props.link) args.link = url;
  else if (props.ids) args.ids = [url]; // Exa's crawling tool takes ids/URLs
  else {
    const key = (cap.required || [])[0] || "url";
    args[key] = props[key]?.type === "array" ? [url] : url;
  }

  if (props.extract_depth) {
    const value = pickEnum(props.extract_depth, ["basic"]);
    if (value) args.extract_depth = value;
  }
  if (props.format) {
    const value = pickEnum(props.format, ["text", "markdown"]);
    if (value) args.format = value;
  }
  for (const key of ["max_length", "maxLength", "max_characters", "maxCharacters", "max_chars"]) {
    if (props[key]) {
      args[key] = clampToSchema(props[key], maxChars);
      break;
    }
  }
  if (props.raw) args.raw = false;
  if (props.include_images) args.include_images = false;
  if (props.onlyMainContent) args.onlyMainContent = true;

  return { ...args, ...extra };
}
