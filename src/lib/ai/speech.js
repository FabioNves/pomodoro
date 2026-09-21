// Text to speech for the quote player. Server only: reads OPENAI_API_KEY
// through getAiConfig() and sends it nowhere but the OpenAI API.
//
// Same contract as chatJson(): failures are AiError with a code the route
// maps to a status (not_configured, rate_limited, quota, timeout, api_error),
// a rate limit is retried once within a short wait, and every call is
// counted by recordExternalCall() for the usage report.

import { AiError, getAiConfig } from "@/lib/ai/openai";
import { recordExternalCall } from "@/lib/usage/track";

export const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";

// How a quote is read. Only the gpt-4o speech models take instructions.
const QUOTE_STYLE =
  "Read this quotation aloud slowly and warmly, like a thoughtful narrator sharing something worth remembering. " +
  "After the quotation, leave a short pause and say the author's name more quietly.";

export function getSpeechConfig() {
  const { apiKey, baseUrl } = getAiConfig();
  return {
    apiKey,
    baseUrl,
    model: (process.env.OPENAI_TTS_MODEL || "").trim() || DEFAULT_TTS_MODEL,
  };
}

export function isSpeechConfigured() {
  return Boolean(getSpeechConfig().apiKey);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Rough token counts for the usage report: the API does not return them. */
function estimateUsage(input, instructions) {
  const words = String(input).trim().split(/\s+/).filter(Boolean).length;
  const seconds = words / 2.5 + 1;
  return {
    prompt_tokens: Math.ceil((input.length + (instructions || "").length) / 4),
    completion_tokens: Math.ceil(seconds * 21),
  };
}

/**
 * @param {object} params
 * @param {string} params.input   the words to read
 * @param {string} params.voice   one of QUOTE_VOICES
 * @param {number} [params.timeoutMs]
 * @returns {Promise<{ audio: Buffer, mime: string, model: string }>}
 */
export async function synthesizeQuote({ input, voice, timeoutMs = 30000, retries = 1 }) {
  const { apiKey, baseUrl, model } = getSpeechConfig();
  if (!apiKey) throw new AiError("OPENAI_API_KEY is not set.", { code: "not_configured" });

  const instructions = /^gpt-4o/.test(model) ? QUOTE_STYLE : undefined;
  const body = JSON.stringify({
    model,
    voice,
    input,
    response_format: "mp3",
    ...(instructions ? { instructions } : {}),
  });

  let attempt = 0;
  for (;;) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(`${baseUrl}/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      recordExternalCall({ provider: "openai", model, usage: null, ok: false });
      if (error?.name === "AbortError") {
        throw new AiError(`OpenAI speech timed out after ${timeoutMs} ms`, { code: "timeout", cause: error });
      }
      throw new AiError(`OpenAI speech request failed: ${error?.message || error}`, { code: "api_error", cause: error });
    }

    if (res.ok) {
      let audio;
      try {
        audio = Buffer.from(await res.arrayBuffer());
      } catch (error) {
        // The timer can fire while the audio is still arriving.
        clearTimeout(timer);
        recordExternalCall({ provider: "openai", model, usage: null, ok: false });
        const timedOut = error?.name === "AbortError";
        throw new AiError(timedOut ? `OpenAI speech timed out after ${timeoutMs} ms` : "OpenAI speech download failed", {
          code: timedOut ? "timeout" : "api_error",
          cause: error,
        });
      }
      clearTimeout(timer);
      recordExternalCall({ provider: "openai", model, usage: estimateUsage(input, instructions), ok: true });
      return { audio, mime: res.headers.get("content-type") || "audio/mpeg", model };
    }
    clearTimeout(timer);

    const text = await res.text().catch(() => "");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    const message = json?.error?.message || text.slice(0, 300);
    recordExternalCall({ provider: "openai", model, usage: null, ok: false });

    if (res.status === 429) {
      // Out of credit is not a rate limit: waiting will not help.
      if (json?.error?.code === "insufficient_quota" || /quota/i.test(message)) {
        throw new AiError(`OpenAI account is out of credit: ${message}`, { code: "quota", status: 429 });
      }
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const wait = Math.min(8000, (retryAfter || 2 ** attempt) * 1000);
      if (attempt <= retries) {
        await sleep(wait);
        continue;
      }
      throw new AiError(`OpenAI rate limit: ${message}`, { code: "rate_limited", status: 429, retryAfter: retryAfter || Math.ceil(wait / 1000) });
    }
    if (res.status >= 500 && attempt <= retries) {
      await sleep(1000 * attempt);
      continue;
    }
    throw new AiError(`OpenAI speech error (${res.status}): ${message}`, {
      code: res.status === 401 || res.status === 403 ? "auth" : "api_error",
      status: res.status,
    });
  }
}
