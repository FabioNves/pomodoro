// MCP configuration, read from the environment. Server only.
//
// One or many servers can be configured, and the three capabilities the
// briefing needs are routed across them independently. That matters because
// providers are not equally good at everything: Brave has a real news tool
// that returns publication dates but cannot fetch a page, while Tavily
// extracts full article text but has no news mode. Routing news to one and
// page fetching to the other gives you both.
//
// The default (unnamed) server keeps the original variables:
//   MCP_SERVER_URL       remote server over Streamable HTTP (SSE fallback)
//   MCP_SERVER_COMMAND   local server over stdio (development only; a
//                        serverless host cannot spawn a long-lived process)
//
// Additional servers are named in the variable itself:
//   MCP_SERVER_BRAVE_COMMAND=npx
//   MCP_SERVER_BRAVE_ARGS=-y @brave/brave-search-mcp-server
//   MCP_SERVER_BRAVE_ENV={"BRAVE_API_KEY":"..."}
//   MCP_SERVER_TAVILY_URL=https://mcp.tavily.com/mcp/?tavilyApiKey=...
//
// Routing is worked out automatically from the tools each server actually
// exposes, and can be pinned with MCP_ROUTE_SEARCH / MCP_ROUTE_NEWS /
// MCP_ROUTE_FETCH, whose values are server names.

export const DEFAULT_SERVER = "default";

function parseJsonEnv(name) {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    console.warn(`[mcp] ${name} is not valid JSON; ignoring it.`);
    return {};
  }
}

// "a b \"c d\"" -> ["a", "b", "c d"]
function parseArgs(raw) {
  if (!raw || !raw.trim()) return [];
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = re.exec(raw))) {
    out.push(match[1] ?? match[2] ?? match[3]);
  }
  return out;
}

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function optional(name) {
  const value = (process.env[name] || "").trim();
  return value || null;
}

/** Env var for a server: prefix("BRAVE","URL") -> "MCP_SERVER_BRAVE_URL". */
function key(name, suffix) {
  return name === DEFAULT_SERVER ? `MCP_SERVER_${suffix}` : `MCP_SERVER_${name.toUpperCase()}_${suffix}`;
}

function readServer(name) {
  const url = (process.env[key(name, "URL")] || "").trim();
  const command = (process.env[key(name, "COMMAND")] || "").trim();
  if (!url && !command) return null;

  const token = (process.env[key(name, "AUTH_TOKEN")] || "").trim();
  const headers = { ...parseJsonEnv(key(name, "HEADERS")) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const transport = url ? "http" : "stdio";
  return {
    name,
    transport,
    url,
    headers,
    command,
    args: parseArgs(process.env[key(name, "ARGS")]),
    env: parseJsonEnv(key(name, "ENV")),
    timeoutMs: intEnv("MCP_TIMEOUT_MS", 30000),
    // A stdio server has to be spawned first, and a command like
    // "npx -y some-mcp-server" may resolve and install the package before it
    // says anything, so it gets far longer than an HTTP handshake needs.
    connectTimeoutMs: intEnv("MCP_CONNECT_TIMEOUT_MS", transport === "stdio" ? 90000 : 15000),
    clientInfo: { name: "pomodrive-news-briefing", version: "1.0.0" },
  };
}

/** Every server named in the environment, default first. */
export function listMcpServers() {
  const names = new Set();
  const fromDefault = readServer(DEFAULT_SERVER);
  if (fromDefault) names.add(DEFAULT_SERVER);

  for (const variable of Object.keys(process.env)) {
    const match = /^MCP_SERVER_([A-Z0-9]+)_(?:URL|COMMAND)$/.exec(variable);
    if (match) names.add(match[1].toLowerCase());
  }

  const servers = [];
  for (const name of names) {
    const config = readServer(name);
    if (config) servers.push(config);
  }
  return servers;
}

/**
 * One server's configuration. Without a name this is the default server, or
 * the only configured server when there is no default, which keeps a
 * single-server setup working exactly as before.
 */
export function getMcpConfig(name) {
  if (name) {
    return readServer(name) || { name, transport: null, url: "", headers: {}, command: "", args: [], env: {}, timeoutMs: intEnv("MCP_TIMEOUT_MS", 30000), connectTimeoutMs: intEnv("MCP_CONNECT_TIMEOUT_MS", 15000), clientInfo: { name: "pomodrive-news-briefing", version: "1.0.0" } };
  }
  const servers = listMcpServers();
  const chosen = servers.find((s) => s.name === DEFAULT_SERVER) || servers[0];
  return (
    chosen || {
      name: DEFAULT_SERVER,
      transport: null,
      url: "",
      headers: {},
      command: "",
      args: [],
      env: {},
      timeoutMs: intEnv("MCP_TIMEOUT_MS", 30000),
      connectTimeoutMs: intEnv("MCP_CONNECT_TIMEOUT_MS", 15000),
      clientInfo: { name: "pomodrive-news-briefing", version: "1.0.0" },
    }
  );
}

export function isMcpConfigured() {
  return listMcpServers().length > 0;
}

/** Server names pinned per capability, or null to decide from the tools. */
export function getMcpRouting() {
  const pick = (variable) => {
    const value = (process.env[variable] || "").trim().toLowerCase();
    return value || null;
  };
  return {
    searchWeb: pick("MCP_ROUTE_SEARCH"),
    searchNews: pick("MCP_ROUTE_NEWS"),
    fetchPage: pick("MCP_ROUTE_FETCH"),
  };
}

/** Tool-name overrides, applied to whichever server serves that capability. */
export function getToolOverrides() {
  return {
    searchWeb: optional("MCP_TOOL_SEARCH_WEB"),
    searchNews: optional("MCP_TOOL_SEARCH_NEWS"),
    fetchPage: optional("MCP_TOOL_FETCH_PAGE"),
  };
}

/** Extra arguments merged into every search / fetch call. */
export function getExtraArgs() {
  return {
    search: parseJsonEnv("MCP_SEARCH_ARGS_JSON"),
    fetch: parseJsonEnv("MCP_FETCH_ARGS_JSON"),
  };
}

/**
 * Human-readable target for logs, error messages and the status endpoint.
 *
 * This string reaches the browser, so it carries no credentials: some hosted
 * servers put the key in the URL path (not only the query string) and stdio
 * servers commonly take it as a command-line argument, so only the origin
 * and the bare command name are shown.
 */
export function describeMcpTarget(config = getMcpConfig()) {
  if (config.transport === "http") {
    try {
      return new URL(config.url).origin;
    } catch {
      return "invalid MCP server URL";
    }
  }
  if (config.transport === "stdio") {
    const command = config.command.split(/[\\/]/).pop() || config.command;
    return `${command} (local process)`;
  }
  return "not configured";
}

/** A key that changes whenever the connection-relevant config changes. */
export function mcpConfigKey(config = getMcpConfig()) {
  return JSON.stringify([
    config.name,
    config.transport,
    config.url,
    config.command,
    config.args,
    Object.keys(config.headers).sort(),
  ]);
}
