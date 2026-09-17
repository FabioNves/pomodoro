// MCP client: one connection per configured server, reconnected on demand.
// Server only.
//
// Wraps @modelcontextprotocol/sdk so the rest of the app only deals with
// listTools() / callTool() and a small McpError vocabulary. Transports are
// imported lazily so the stdio transport (child processes) is never pulled
// into a build that only uses the remote server.

import {
  getMcpConfig,
  describeMcpTarget,
  mcpConfigKey,
} from "@/lib/mcp/config";
import { recordExternalCall } from "@/lib/usage/track";

export class McpError extends Error {
  /**
   * @param {string} message
   * @param {{code?: string, cause?: unknown, tool?: string}} [opts]
   *   code: not_configured | connect_failed | tool_not_found | tool_error |
   *         timeout | malformed_result | unavailable
   */
  constructor(message, { code = "unavailable", cause, tool } = {}) {
    super(message);
    this.name = "McpError";
    this.code = code;
    this.cause = cause;
    this.tool = tool;
  }
}

// One entry per server name, so several providers can be live at once.
const cached = new Map();
const connecting = new Map();

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new McpError(`${label} timed out after ${ms} ms`, {
            code: "timeout",
          }),
        ),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function makeClient(config) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  return new Client(config.clientInfo, { capabilities: {} });
}

async function connectHttp(config) {
  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  );
  const url = new URL(config.url);
  const requestInit = Object.keys(config.headers).length
    ? { headers: config.headers }
    : undefined;

  const attempt = async (transportKind) => {
    const client = await makeClient(config);
    let transport;
    if (transportKind === "streamable-http") {
      transport = new StreamableHTTPClientTransport(url, { requestInit });
    } else {
      const { SSEClientTransport } = await import(
        "@modelcontextprotocol/sdk/client/sse.js"
      );
      transport = new SSEClientTransport(url, { requestInit });
    }
    try {
      await withTimeout(
        client.connect(transport),
        config.connectTimeoutMs,
        "MCP connect",
      );
    } catch (error) {
      await transport.close().catch(() => {});
      throw error;
    }
    return { client, transport, transportKind };
  };

  // The spec's backwards-compatibility rule: try Streamable HTTP first and
  // fall back to the older HTTP+SSE transport if the server rejects it.
  try {
    return await attempt("streamable-http");
  } catch (primaryError) {
    if (primaryError?.code === "timeout") throw primaryError;
    try {
      return await attempt("sse");
    } catch {
      throw primaryError;
    }
  }
}

async function connectStdio(config) {
  const { StdioClientTransport, getDefaultEnvironment } = await import(
    "@modelcontextprotocol/sdk/client/stdio.js"
  );
  const client = await makeClient(config);
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: { ...getDefaultEnvironment(), ...config.env },
    stderr: "pipe",
  });
  try {
    await withTimeout(
      client.connect(transport),
      config.connectTimeoutMs,
      "MCP connect",
    );
  } catch (error) {
    await transport.close().catch(() => {});
    throw error;
  }
  // The child's stderr is piped, so it must be drained: a chatty server that
  // fills the pipe buffer would otherwise block on its own logging.
  transport.stderr?.on("data", (chunk) => {
    const line = String(chunk).trim();
    if (line) console.log(`[mcp:stderr] ${line.slice(0, 500)}`);
  });
  return { client, transport, transportKind: "stdio" };
}

async function listAllTools(client, timeoutMs) {
  const tools = [];
  let cursor;
  do {
    const page = await withTimeout(
      client.listTools(cursor ? { cursor } : undefined),
      timeoutMs,
      "MCP tools/list",
    );
    tools.push(...(page?.tools || []));
    cursor = page?.nextCursor;
  } while (cursor && tools.length < 500);
  return tools;
}

async function openConnection(config) {
  const target = describeMcpTarget(config);
  let conn;
  try {
    conn =
      config.transport === "http"
        ? await connectHttp(config)
        : await connectStdio(config);
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      `Could not connect to the MCP server (${target}): ${error?.message || error}`,
      { code: "connect_failed", cause: error },
    );
  }

  let tools;
  try {
    tools = await listAllTools(conn.client, config.timeoutMs);
  } catch (error) {
    await conn.transport.close().catch(() => {});
    if (error instanceof McpError) throw error;
    throw new McpError(
      `MCP server (${target}) did not return its tool list: ${error?.message || error}`,
      { code: "connect_failed", cause: error },
    );
  }

  const version = conn.client.getServerVersion?.() || {};
  return {
    name: config.name,
    client: conn.client,
    transport: conn.transport,
    transportKind: conn.transportKind,
    tools,
    serverInfo: { name: version.name || "", version: version.version || "" },
    key: mcpConfigKey(config),
    target,
    connectedAt: Date.now(),
  };
}

/**
 * The connection to one server, opened on first use and reused afterwards.
 * Pass a server name to reach a specific provider, or none for the default.
 * `fresh: true` drops a connection that turned out to be dead.
 */
export async function getConnection({ fresh = false, server } = {}) {
  const config = getMcpConfig(server);
  const name = config.name;
  if (!config.transport) {
    throw new McpError(
      server
        ? `MCP server "${server}" is not configured.`
        : "No MCP server is configured. Set MCP_SERVER_URL (or MCP_SERVER_COMMAND for local development).",
      { code: "not_configured" },
    );
  }
  const key = mcpConfigKey(config);
  const existing = cached.get(name);

  if (fresh || (existing && existing.key !== key)) {
    await closeConnection(name);
  } else if (existing) {
    return existing;
  }
  const pending = connecting.get(name);
  if (pending) return pending;

  const promise = openConnection(config)
    .then((conn) => {
      cached.set(name, conn);
      return conn;
    })
    .finally(() => {
      connecting.delete(name);
    });
  connecting.set(name, promise);
  return promise;
}

/** Close one server's connection, or every one when no name is given. */
export async function closeConnection(server) {
  const names = server ? [server] : [...cached.keys()];
  for (const name of names) {
    const conn = cached.get(name);
    cached.delete(name);
    if (!conn) continue;
    try {
      await conn.client.close();
    } catch {
      try {
        await conn.transport.close();
      } catch {
        /* ignore */
      }
    }
  }
}

export async function listTools(server) {
  return (await getConnection({ server })).tools;
}

/**
 * HTTP status behind a transport error, when there is one. The SDK's
 * StreamableHTTPError / SseError carry it in `code` (JSON-RPC errors use
 * negative codes there, so only 4xx/5xx count).
 */
function httpStatus(error) {
  const code = error?.code;
  if (typeof code === "number" && code >= 400 && code < 600) return code;
  const match = /(?:http|status(?:\s+code)?)\D{0,3}(4\d{2}|5\d{2})\b/i.exec(error?.message || "");
  return match ? Number(match[1]) : null;
}

function isConnectionError(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return (
    /not connected|connection closed|econnreset|econnrefused|socket hang up|fetch failed|session (not found|expired)|terminated|transport/.test(
      text,
    ) ||
    (typeof error?.code === "number" && error.code === -32000) // ConnectionClosed
  );
}

/**
 * Call a tool and return the raw MCP result ({ content, structuredContent,
 * isError }). Retries once on a fresh connection when the transport died.
 */
export async function callTool(name, args = {}, { timeoutMs, server } = {}) {
  const config = getMcpConfig(server);
  const timeout = timeoutMs || config.timeoutMs;

  const run = async (conn) => {
    const known = conn.tools.some((t) => t.name === name);
    if (!known) {
      throw new McpError(
        `The MCP server does not expose a tool named "${name}".`,
        { code: "tool_not_found", tool: name },
      );
    }
    let result;
    try {
      result = await conn.client.callTool(
        { name, arguments: args },
        undefined,
        { timeout, resetTimeoutOnProgress: true },
      );
      recordExternalCall({ provider: "mcp", model: `${config.name || server || "default"}/${name}`, ok: true });
    } catch (error) {
      recordExternalCall({ provider: "mcp", model: `${config.name || server || "default"}/${name}`, ok: false });
      const message = error?.message || String(error);
      if (/timed? ?out/i.test(message) || error?.code === -32001) {
        throw new McpError(`MCP tool "${name}" timed out after ${timeout} ms`, {
          code: "timeout",
          cause: error,
          tool: name,
        });
      }
      const status = httpStatus(error);
      if (status === 429) {
        throw new McpError(`The MCP server is rate limiting requests (HTTP 429)`, {
          code: "rate_limited",
          cause: error,
          tool: name,
        });
      }
      if (status === 401 || status === 403) {
        throw new McpError(
          `The MCP server rejected the credentials (HTTP ${status}); check its API key.`,
          { code: "auth", cause: error, tool: name },
        );
      }
      // A gone session (404/410) or a dropped transport is worth one retry on
      // a fresh connection: the cached one is dead.
      if (status === 404 || status === 410 || isConnectionError(error)) {
        throw Object.assign(
          new McpError(`MCP connection lost while calling "${name}"`, {
            code: "connect_failed",
            cause: error,
            tool: name,
          }),
          { retryable: true },
        );
      }
      throw new McpError(`MCP tool "${name}" failed: ${message}`, {
        code: "tool_error",
        cause: error,
        tool: name,
      });
    }
    if (!result || typeof result !== "object") {
      throw new McpError(`MCP tool "${name}" returned no result`, {
        code: "malformed_result",
        tool: name,
      });
    }
    return result;
  };

  try {
    return await run(await getConnection({ server }));
  } catch (error) {
    if (error?.retryable) {
      return run(await getConnection({ fresh: true, server }));
    }
    throw error;
  }
}

/**
 * Cheap liveness check used by the status endpoint. Returns false when the
 * server does not answer; only a genuinely broken transport drops the cached
 * connection, because not every server implements ping.
 */
export async function pingServer(server) {
  const conn = await getConnection({ server });
  try {
    await withTimeout(conn.client.ping(), 5000, "MCP ping");
    return true;
  } catch (error) {
    if (isConnectionError(error) || [404, 410].includes(httpStatus(error))) {
      await closeConnection(conn.name);
    }
    return false;
  }
}
