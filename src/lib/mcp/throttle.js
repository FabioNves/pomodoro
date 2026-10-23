// Pacing and back-off per MCP server. Server only.
//
// Search providers cap requests per minute per key, and a briefing edition
// makes twenty-odd calls in a burst (searches three at a time, then page
// fetches), so unpaced it trips the cap and every later call is refused at
// once. Each server gets its calls spaced to its rpm (see serverRpm() in
// config.js), and when one answers "rate limited" every caller of that
// server waits out the same pause rather than each hammering it again.
//
// The state lives in this module, so it covers one function invocation; a
// briefing runs its editions one invocation after another, which is the
// burst that matters.

const servers = new Map(); // name -> { next, blockedUntil }

const state = (server) => {
  const key = server || "default";
  if (!servers.has(key)) servers.set(key, { next: 0, blockedUntil: 0 });
  return servers.get(key);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for this server's next free slot. Returns false, without waiting or
 * taking the slot, when the slot comes after `deadlineAt`.
 */
export async function takeTurn(server, rpm = 60, deadlineAt = Infinity) {
  const s = state(server);
  const now = Date.now();
  const at = Math.max(now, s.next, s.blockedUntil);
  if (at > deadlineAt) return false;
  // Taken before sleeping, so concurrent callers queue behind it.
  s.next = at + 60000 / Math.max(1, rpm);
  if (at > now) await sleep(at - now);
  return true;
}

/** The server asked us to slow down: no call to it starts for `ms`. */
export function backOff(server, ms) {
  const s = state(server);
  s.blockedUntil = Math.max(s.blockedUntil, Date.now() + ms);
}

const BACKOFF_MS = [4000, 10000, 20000];
export const MAX_RATE_RETRIES = BACKOFF_MS.length;

/**
 * How long to wait before retry `attempt` (0-based): what the provider said
 * ("retry after 12 s", "try again in 2 minutes") when it said something
 * usable, otherwise a growing pause, jittered so parallel callers spread out.
 */
export function retryDelay(message, attempt) {
  const hint = /(?:retry|try again)\D{0,20}?(\d+(?:\.\d+)?)\s*(ms|millisecond|s\b|sec|second|m\b|min|minute)?/i.exec(
    String(message || ""),
  );
  if (hint) {
    const value = Number(hint[1]);
    const unit = (hint[2] || "s").toLowerCase();
    const ms = unit.startsWith("ms") || unit.startsWith("milli") ? value : unit.startsWith("m") ? value * 60000 : value * 1000;
    if (ms > 0) return Math.min(ms, 60000);
  }
  const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
  return Math.round(base * (0.85 + Math.random() * 0.3));
}

/** For tests: forget every server's pacing. */
export function resetThrottle() {
  servers.clear();
}
