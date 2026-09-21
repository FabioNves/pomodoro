// Reading quotes aloud in the quote player. Browser only.
//
// Two voices: the device's own speech synthesis (free, offline, sounds like
// whatever the operating system ships) and the AI voice, which the server
// renders once per quote and voice (POST /api/notebook/quotes/speech). AI
// clips are kept as object URLs for the life of the page, so going round the
// same quotes again costs nothing and starts at once.

const SILENCE =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
const MAX_CLIPS = 60;

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  try {
    const token = localStorage.getItem("accessToken");
    const userId = localStorage.getItem("userId");
    if (token) headers.Authorization = `Bearer ${token}`;
    if (userId) headers["user-id"] = userId;
  } catch {
    /* storage blocked: the request will be refused and say so */
  }
  return headers;
}

/** Error from the speech route, with what the player needs to explain it. */
export class VoiceError extends Error {
  constructor(message, { status = 0, code = "", retryAfter = 0 } = {}) {
    super(message);
    this.name = "VoiceError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/* ── AI voice ──────────────────────────────────────────── */

let abilityPromise = null;

/** { available, voices, defaultVoice } from the server; asked once per page. */
export function aiVoiceAbility() {
  if (!abilityPromise) {
    abilityPromise = fetch("/api/notebook/quotes/speech", { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) return { available: false, reason: data?.error || `Unavailable (${res.status})` };
        return data;
      })
      .catch(() => ({ available: false, reason: "The server could not be reached." }));
    // A failure is worth asking again about next time the player opens.
    abilityPromise.then((a) => {
      if (!a?.available) abilityPromise = null;
    });
  }
  return abilityPromise;
}

const clips = new Map(); // `${voice}\n${author}\n${text}` -> Promise<objectURL>

function remember(key, promise) {
  clips.set(key, promise);
  while (clips.size > MAX_CLIPS) {
    const [oldest, old] = clips.entries().next().value;
    clips.delete(oldest);
    old.then((url) => URL.revokeObjectURL(url)).catch(() => {});
  }
}

/**
 * Object URL of the AI voice reading `quote`, fetched once per voice.
 * @returns {Promise<string>}
 */
export function aiClip(quote, voice) {
  const key = `${voice}\n${quote.author || ""}\n${quote.text}`;
  const hit = clips.get(key);
  if (hit) {
    // Most recent last, so the clip about to play is never the one evicted.
    clips.delete(key);
    clips.set(key, hit);
    return hit;
  }
  const promise = fetch("/api/notebook/quotes/speech", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ text: quote.text, author: quote.author || undefined, voice }),
  }).then(async (res) => {
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new VoiceError(data?.error || `The AI voice failed (${res.status}).`, {
        status: res.status,
        code: data?.code || "",
        retryAfter: Number(data?.retryAfter) || 0,
      });
    }
    return URL.createObjectURL(await res.blob());
  });
  remember(key, promise);
  // A failed clip is not kept: the next attempt should really try again.
  promise.catch(() => {
    if (clips.get(key) === promise) clips.delete(key);
  });
  return promise;
}

/**
 * Lets later, programmatic playback through `audio` start on phones that
 * only allow sound in response to a tap. Call it from the tap itself.
 */
export function unlockAudio(audio) {
  if (!audio) return;
  try {
    audio.muted = true;
    audio.src = SILENCE;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        audio.pause();
        audio.muted = false;
      }).catch(() => {
        audio.muted = false;
      });
    } else {
      audio.muted = false;
    }
  } catch {
    audio.muted = false;
  }
}

/** Plays `url` through `audio`; resolves when it ends or `signal` aborts. */
export function playClip(audio, url, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return resolve();
    const cleanup = () => {
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onEnd = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new VoiceError("The clip could not be played."));
    };
    const onAbort = () => {
      cleanup();
      audio.pause();
      resolve();
    };
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort);
    audio.muted = false;
    audio.src = url;
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch((error) => {
        cleanup();
        reject(
          new VoiceError(
            error?.name === "NotAllowedError" ? "Tap play to let the page read aloud." : "The clip could not be played.",
            { code: error?.name === "NotAllowedError" ? "blocked" : "" },
          ),
        );
      });
    }
  });
}

/* ── Device voice ──────────────────────────────────────── */

export function deviceVoiceAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/**
 * Reads `text` with the device's speech synthesis; resolves when it is done,
 * when `signal` aborts, or after a generous cap (some engines never say
 * they finished).
 */
export function speakWithDevice(text, signal, { rate = 0.95 } = {}) {
  return new Promise((resolve) => {
    if (!deviceVoiceAvailable() || signal?.aborted) return resolve();
    const synth = window.speechSynthesis;
    const words = String(text).split(/\s+/).length;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(cap);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = () => {
      synth.cancel();
      finish();
    };
    const cap = setTimeout(finish, (words / 1.6 + 6) * 1000);
    signal?.addEventListener("abort", onAbort);
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.onend = finish;
    utterance.onerror = finish;
    synth.speak(utterance);
  });
}

/** How long a quote stays up in silent auto mode: long enough to read it. */
export function readingTimeMs(text) {
  const words = String(text || "").split(/\s+/).filter(Boolean).length;
  return Math.round(Math.min(20000, Math.max(5500, 3000 + words * 330)));
}
