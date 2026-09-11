// Minimal OpenAI Chat Completions client with strict JSON-schema output.
// Server only: reads OPENAI_API_KEY from the environment and never sends it
// anywhere but api.openai.com (or OPENAI_BASE_URL).
//
// Deliberately a small fetch wrapper rather than the SDK: one endpoint, one
// response shape, explicit retries and timeouts.

export class AiError extends Error {
  /**
   * @param {string} message
   * @param {{code?: string, status?: number, cause?: unknown}} [opts]
   *   code: not_configured | rate_limited | timeout | api_error | refusal |
   *         invalid_json | truncated
   */
  constructor(message, { code = "api_error", status, cause } = {}) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export const DEFAULT_MODEL = "gpt-4.1-mini";

export function getAiConfig() {
  return {
    apiKey: (process.env.OPENAI_API_KEY || "").trim(),
    model: (process.env.OPENAI_MODEL || "").trim() || DEFAULT_MODEL,
    baseUrl: ((process.env.OPENAI_BASE_URL || "").trim() || "https://api.openai.com/v1").replace(/\/+$/, ""),
  };
}

export function isOpenAiConfigured() {
  return Boolean(getAiConfig().apiKey);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postChat(body, { timeoutMs }) {
  const { apiKey, baseUrl } = getAiConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { res, json, text };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new AiError(`OpenAI request timed out after ${timeoutMs} ms`, { code: "timeout", cause: error });
    }
    throw new AiError(`OpenAI request failed: ${error?.message || error}`, { code: "api_error", cause: error });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the model for a JSON object that matches `schema` (a strict JSON
 * Schema: every property required, additionalProperties false).
 *
 * @param {object} params
 * @param {string} params.system
 * @param {string} params.user
 * @param {object} params.schema
 * @param {string} params.schemaName
 * @param {number} [params.maxTokens]
 * @param {number} [params.timeoutMs]
 * @param {number} [params.retries]
 * @returns {Promise<{ data: object, model: string, usage: object|null }>}
 */
export async function chatJson({
  system,
  user,
  schema,
  schemaName,
  maxTokens = 4000,
  timeoutMs = 90000,
  retries = 2,
  deadlineAt = null,
}) {
  const { apiKey, model } = getAiConfig();
  if (!apiKey) {
    throw new AiError("OPENAI_API_KEY is not set.", { code: "not_configured" });
  }

  // Every attempt (and every backoff) has to fit inside the caller's
  // deadline, otherwise retrying a slow call would blow the function's time
  // limit and leave the work with nowhere to report back to.
  const timeLeft = () => (deadlineAt ? deadlineAt - Date.now() : Infinity);
  const attemptTimeout = () => {
    if (!deadlineAt) return timeoutMs;
    return Math.max(5000, Math.min(timeoutMs, timeLeft() - 2000));
  };
  const canRetry = (attempt, backoffMs) =>
    attempt <= retries && timeLeft() > backoffMs + 15000;

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: schemaName, strict: true, schema },
    },
    max_completion_tokens: maxTokens,
  };

  let attempt = 0;
  let lastError = null;
  while (attempt <= retries) {
    attempt += 1;
    let outcome;
    try {
      outcome = await postChat(body, { timeoutMs: attemptTimeout() });
    } catch (error) {
      lastError = error;
      if (error.code === "timeout" && canRetry(attempt, 1000 * attempt)) {
        await sleep(1000 * attempt);
        continue;
      }
      throw error;
    }

    const { res, json, text } = outcome;
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      lastError = new AiError(
        `OpenAI ${res.status === 429 ? "rate limit" : "server error"} (${res.status}): ${json?.error?.message || text.slice(0, 200)}`,
        { code: res.status === 429 ? "rate_limited" : "api_error", status: res.status },
      );
      const backoff = Math.min(20000, (retryAfter || 2 ** attempt) * 1000);
      if (canRetry(attempt, backoff)) {
        await sleep(backoff);
        continue;
      }
      throw lastError;
    }
    if (!res.ok) {
      throw new AiError(`OpenAI error (${res.status}): ${json?.error?.message || text.slice(0, 300)}`, {
        code: res.status === 401 || res.status === 403 ? "auth" : "api_error",
        status: res.status,
      });
    }

    const choice = json?.choices?.[0];
    const message = choice?.message;
    if (message?.refusal) {
      throw new AiError(`The model refused the request: ${message.refusal}`, { code: "refusal" });
    }
    if (choice?.finish_reason === "length") {
      throw new AiError("The model's answer was cut off (max tokens reached).", { code: "truncated" });
    }
    const content = typeof message?.content === "string" ? message.content : "";
    try {
      return { data: JSON.parse(content), model: json?.model || model, usage: json?.usage || null };
    } catch (error) {
      lastError = new AiError("The model returned invalid JSON.", { code: "invalid_json", cause: error });
      if (canRetry(attempt, 0)) continue;
      throw lastError;
    }
  }
  throw lastError || new AiError("OpenAI request failed.");
}
