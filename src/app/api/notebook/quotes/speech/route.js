import crypto from "crypto";
import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookQuote from "@/models/NotebookQuote";
import QuoteSpeech from "@/models/QuoteSpeech";
import { requireUser } from "@/lib/sessionAuth";
import { jsonError, validateJsonBody } from "@/utils/apiValidation";
import { AiError } from "@/lib/ai/openai";
import { getSpeechConfig, isSpeechConfigured, synthesizeQuote } from "@/lib/ai/speech";
import {
  DEFAULT_QUOTES,
  DEFAULT_QUOTE_VOICE,
  QUOTE_LIMITS,
  QUOTE_VOICES,
  authorKey,
  normalizeQuoteText,
  spokenQuote,
  voicesForModel,
} from "@/lib/notebook/quotes";

// The quote player reading a quote aloud with the AI voice.
//
// Only quotes the reader has (or the built-in ones the dashboard falls back
// on) are read: the words spoken are looked up here, never taken from the
// request, so the route cannot be used to voice arbitrary text. Every clip
// is kept (QuoteSpeech), so a quote costs one synthesis per voice, however
// often the player comes back to it. A reader can have a limited number of
// new clips made a day (QUOTE_VOICE_DAILY_LIMIT, default 200); replaying
// kept clips is never limited.

export const maxDuration = 60;

function dailyLimit() {
  const n = Number(process.env.QUOTE_VOICE_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 200;
}

const SIGN_IN = { signInMessage: "Sign in to hear your quotes.", feature: "ai_voice" };
const VOICE_KEYS = QUOTE_VOICES.map((v) => v.key);

const speechSchema = z.object({
  text: z.string().trim().min(1).max(QUOTE_LIMITS.text),
  author: z.string().trim().max(QUOTE_LIMITS.author).optional(),
  voice: z.enum(VOICE_KEYS).optional(),
});

function aiErrorResponse(error) {
  const status =
    error.code === "not_configured"
      ? 503
      : error.code === "rate_limited" || error.code === "quota"
        ? 429
        : error.code === "timeout"
          ? 504
          : 502;
  const message =
    error.code === "not_configured"
      ? "The AI voice is not set up on this server."
      : error.code === "quota"
        ? "The AI voice is out of credit on this server."
        : error.code === "rate_limited"
          ? "The AI voice is busy. Try again in a moment."
          : error.code === "timeout"
            ? "The AI voice took too long."
            : "The AI voice could not read this quote.";
  return Response.json(
    { error: message, code: error.code, ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) },
    { status },
  );
}

/** The quote to read: one of the reader's own, or a built-in one. */
async function findQuote(userId, text, author) {
  const wanted = normalizeQuoteText(text);
  const wantedAuthor = author ? authorKey(author) : "";
  const matches = (q) =>
    normalizeQuoteText(q.text) === wanted && (!wantedAuthor || authorKey(q.author) === wantedAuthor);

  const builtIn = DEFAULT_QUOTES.find(matches);
  if (builtIn) return builtIn;

  // Compared after normalising (case, punctuation, curly or straight
  // apostrophes), which a database query cannot do; a notebook holds few
  // enough quotes to compare them all.
  const candidates = await NotebookQuote.find({ user: userId }).select("text author").limit(5000).lean();
  return candidates.find(matches) || null;
}

// GET /api/notebook/quotes/speech — can this server read quotes aloud?
export async function GET(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const voices = voicesForModel(getSpeechConfig().model);
  return Response.json({
    available: isSpeechConfigured(),
    voices,
    defaultVoice: voices.some((v) => v.key === DEFAULT_QUOTE_VOICE) ? DEFAULT_QUOTE_VOICE : voices[0].key,
  });
}

// POST /api/notebook/quotes/speech  { text, author?, voice? }  -> audio/mpeg
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, speechSchema);
  if (!body.ok) return body.response;

  const { text, author, voice = DEFAULT_QUOTE_VOICE } = body.data;
  try {
    await connectToDB();
    const quote = await findQuote(auth.userId, text, author);
    if (!quote) return jsonError(404, "Only your own quotes can be read aloud.");

    const input = spokenQuote(quote);
    const { model } = getSpeechConfig();
    if (!voicesForModel(model).some((v) => v.key === voice)) {
      return jsonError(400, "That voice is not available with this server's speech model.");
    }
    const key = crypto.createHash("sha256").update(`${model}\n${voice}\nquote-v1\n${input}`).digest("hex");

    let clip = await QuoteSpeech.findOne({ key }).lean();
    if (!clip) {
      if (!isSpeechConfigured()) throw new AiError("OPENAI_API_KEY is not set.", { code: "not_configured" });
      const madeToday = await QuoteSpeech.countDocuments({
        user: auth.userId,
        createdAt: { $gt: new Date(Date.now() - 24 * 3600 * 1000) },
      });
      if (madeToday >= dailyLimit()) {
        return Response.json(
          { error: "That is a lot of new quotes read aloud today. The ones already heard still play; try new ones tomorrow.", code: "daily_limit" },
          { status: 429 },
        );
      }
      const made = await synthesizeQuote({ input, voice });
      try {
        clip = (
          await QuoteSpeech.create({
            key,
            user: auth.userId,
            model: made.model,
            voice,
            mime: made.mime,
            audio: made.audio,
            bytes: made.audio.length,
          })
        ).toObject();
      } catch (error) {
        // Two readers asked for the same new clip at once; either copy will do.
        if (error?.code !== 11000) throw error;
        clip = { mime: made.mime, audio: made.audio };
      }
    }

    const audio = Buffer.isBuffer(clip.audio) ? clip.audio : Buffer.from(clip.audio.buffer || clip.audio);
    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": clip.mime || "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    if (error instanceof AiError) return aiErrorResponse(error);
    console.error("[quotes] speech failed", error);
    return jsonError(500, "Could not read the quote aloud.");
  }
}
