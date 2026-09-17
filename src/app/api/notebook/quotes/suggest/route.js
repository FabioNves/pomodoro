import { z } from "zod";
import { requireUser } from "@/lib/sessionAuth";
import { jsonError, validateJsonBody } from "@/utils/apiValidation";
import { AiError, isOpenAiConfigured, suggestQuotes } from "@/lib/ai/quotes";
import { researchQuotes, isMcpConfigured } from "@/lib/notebook/quoteResearch";
import { QUOTE_LIMITS } from "@/lib/notebook/quotes";
import { issueQuoteProof } from "@/lib/notebook/quotesServer";

// AI quote suggestions for an author. Nothing is stored: the browser shows
// the candidates and only the ones the user ticks are sent to
// POST /api/notebook/quotes.
//
// With `useWeb` the MCP server searches the web for pages that collect the
// author's quotes first, and the model may only quote from those pages;
// each quote is then checked verbatim against the page it cites. Without
// it the model answers from memory and every quote comes back unverified.

export const maxDuration = 120;

const suggestSchema = z.object({
  author: z.string().trim().min(1).max(QUOTE_LIMITS.author),
  work: z.string().trim().max(QUOTE_LIMITS.source).optional(),
  topic: z.string().trim().max(300).optional(),
  count: z.number().int().min(1).max(QUOTE_LIMITS.suggestions).optional(),
  useWeb: z.boolean().optional(),
  existing: z.array(z.string().trim().max(QUOTE_LIMITS.text)).max(100).optional(),
});

function aiErrorResponse(error) {
  if (!(error instanceof AiError)) return null;
  const status =
    error.code === "not_configured" ? 503 : error.code === "rate_limited" ? 429 : error.code === "timeout" ? 504 : 502;
  // A rate limit is the provider throttling this account, not a fault in the
  // request, so say how long to wait when it told us.
  const wait = Math.min(300, Math.round(Number(error.retryAfter) || 0));
  const message =
    error.code === "not_configured"
      ? "AI suggestions are not set up on this server."
      : error.code === "rate_limited"
        ? wait
          ? `The AI service is rate limiting this account. Try again in about ${wait} second${wait === 1 ? "" : "s"}.`
          : "The AI service is rate limiting this account. It usually clears in under a minute."
        : error.code === "timeout"
          ? "The AI service took too long. Try again."
          : "The AI service could not suggest quotes.";
  return Response.json({ error: message, code: error.code, ...(wait ? { retryAfter: wait } : {}) }, { status });
}

// GET /api/notebook/quotes/suggest — what this server can do.
export async function GET(req) {
  const auth = await requireUser(req, { signInMessage: "Sign in to use AI suggestions.", feature: "ai_quotes" });
  if (!auth.ok) return auth.response;
  return Response.json({ ai: isOpenAiConfigured(), web: isOpenAiConfigured() && isMcpConfigured() });
}

// POST /api/notebook/quotes/suggest  { author, topic?, count?, useWeb?, existing? }
export async function POST(req) {
  const auth = await requireUser(req, { signInMessage: "Sign in to use AI suggestions.", feature: "ai_quotes" });
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, suggestSchema);
  if (!body.ok) return body.response;

  if (!isOpenAiConfigured()) {
    return Response.json({ error: "AI suggestions are not set up on this server.", code: "not_configured" }, { status: 503 });
  }

  const { author, work = "", topic = "", count = 8, useWeb = false, existing = [] } = body.data;
  const deadlineAt = Date.now() + (maxDuration - 5) * 1000;
  const warnings = [];
  let material = [];
  let searched = false;

  if (useWeb) {
    if (!isMcpConfigured()) {
      warnings.push("Web search is not set up on this server; the quotes come from the model's memory instead.");
    } else {
      searched = true;
      try {
        const research = await researchQuotes({ author, work, topic });
        material = research.material;
        if (!material.length) {
          warnings.push(
            research.error
              ? `Web search failed (${research.error}); the quotes come from the model's memory instead.`
              : `No usable pages were found for ${work ? `"${work}"` : "this author"}; the quotes come from the model's memory instead.`,
          );
        }
      } catch (error) {
        console.error("[quotes] research failed", error);
        warnings.push("Web search failed; the quotes come from the model's memory instead.");
      }
    }
  }

  try {
    const { quotes, model } = await suggestQuotes({ author, work, topic, count, existing, material, deadlineAt });
    // With material, only what was checked against a page is offered; the
    // rest would be memory dressed up as research.
    const verified = quotes.filter((q) => q.verified);
    const list = material.length ? verified : quotes;
    if (material.length && !verified.length && quotes.length) {
      warnings.push("The pages found did not contain the quotes verbatim, so none could be verified.");
    }
    return Response.json({
      // A quote found on a page carries a proof, which the save route checks
      // before it will store the "found on the page" badge.
      quotes: list.map((q) => ({
        ...q,
        origin: q.verified ? "web" : "ai",
        ...(q.verified ? { proof: issueQuoteProof(auth.userId, q) } : {}),
      })),
      searched,
      sources: material.map((m) => ({ id: m.id, title: m.title, url: m.url, domain: m.domain })),
      warnings,
      model,
    });
  } catch (error) {
    const known = aiErrorResponse(error);
    if (known) return known;
    console.error("[quotes] suggest failed", error);
    return jsonError(500, "Could not suggest quotes.");
  }
}
