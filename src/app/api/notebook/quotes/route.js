import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookQuote from "@/models/NotebookQuote";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody, validateSearchParams } from "@/utils/apiValidation";
import { SIGN_IN, objectId, run, apiError } from "@/lib/notebook/server";
import { QUOTE_LIMITS, cleanQuoteText } from "@/lib/notebook/quotes";
import {
  quoteDto,
  listAuthors,
  ensureAuthor,
  dropEmptyAuthors,
  saveQuotes,
} from "@/lib/notebook/quotesServer";

const quoteText = z.string().trim().min(1).max(QUOTE_LIMITS.text).transform(cleanQuoteText);
const authorName = z.string().trim().max(QUOTE_LIMITS.author);
const sourceText = z.string().trim().max(QUOTE_LIMITS.source);
const sourceUrl = z
  .string()
  .trim()
  .max(QUOTE_LIMITS.sourceUrl)
  .refine((v) => !v || /^https?:\/\//i.test(v), "Must be an http(s) URL");

// `verified` is deliberately not accepted from the browser. It is earned by
// `proof`, the token the suggest route signs for a quote it found verbatim
// on the page it cites, so the badge cannot be claimed by a hand-made
// request (see issueQuoteProof in lib/notebook/quotesServer.js).
const quoteInput = z.object({
  text: quoteText,
  author: authorName.optional(),
  source: sourceText.optional(),
  sourceUrl: sourceUrl.optional(),
  origin: z.enum(["manual", "ai", "web"]).optional(),
  proof: z.string().max(200).optional(),
  active: z.boolean().optional(),
});

// GET /api/notebook/quotes[?scope=active]
// Every quote with the authors, or (scope=active) only the quotes the
// dashboard may show: active quotes of active authors.
export async function GET(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const query = validateSearchParams(req, z.object({ scope: z.enum(["all", "active"]).optional() }));
  if (!query.ok) return query.response;

  return run("GET quotes", async () => {
    await connectToDB();
    const active = query.data.scope === "active";
    const [quotes, authors] = await Promise.all([
      NotebookQuote.find({ user: auth.userId, ...(active ? { active: true } : {}) }).sort({ createdAt: -1 }),
      listAuthors(auth.userId),
    ]);
    const activeKeys = new Set(authors.filter((a) => a.active).map((a) => a.key));
    const list = active ? quotes.filter((q) => activeKeys.has(q.authorKey)) : quotes;
    return Response.json({ quotes: list.map(quoteDto), authors });
  });
}

// POST /api/notebook/quotes  { text, author?, … } or { quotes: [ … ] }
// Saves one or many quotes, skipping any the notebook already has.
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.union([z.object({ quotes: z.array(quoteInput).min(1).max(QUOTE_LIMITS.perRequest) }), quoteInput]),
  );
  if (!body.ok) return body.response;

  return run("POST quotes", async () => {
    await connectToDB();
    const items = "quotes" in body.data ? body.data.quotes : [body.data];
    const { created, skipped } = await saveQuotes(auth.userId, items);
    const authors = await listAuthors(auth.userId);
    return Response.json({ quotes: created.map(quoteDto), skipped, authors }, { status: 201 });
  });
}

// PATCH /api/notebook/quotes  { id, text?, author?, source?, sourceUrl?, active? }
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      id: objectId,
      text: quoteText.optional(),
      author: authorName.optional(),
      source: sourceText.optional(),
      sourceUrl: sourceUrl.optional(),
      active: z.boolean().optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("PATCH quotes", async () => {
    await connectToDB();
    const { id, text, author, source, sourceUrl: url, active } = body.data;
    const quote = await NotebookQuote.findOne({ _id: id, user: auth.userId });
    if (!quote) throw apiError(404, "Quote not found");

    const previousKey = quote.authorKey;
    if (text !== undefined) {
      // cleanQuoteText() strips surrounding quotation marks, so a text of
      // nothing but those marks arrives here empty.
      if (!text) throw apiError(400, "Give the quote some words");
      quote.text = text;
    }
    if (source !== undefined) quote.source = source;
    if (url !== undefined) quote.sourceUrl = url;
    if (active !== undefined) quote.active = active;
    if (author !== undefined) {
      const record = await ensureAuthor(auth.userId, author);
      quote.author = record.name;
      quote.authorKey = record.key;
    }
    if (text !== undefined || author !== undefined) {
      // Edited words are the user's own again.
      quote.origin = "manual";
      quote.verified = false;
      if (text !== undefined) quote.sourceUrl = url !== undefined ? url : "";
    }
    await quote.save();
    if (previousKey !== quote.authorKey) await dropEmptyAuthors(auth.userId, [previousKey]);
    const authors = await listAuthors(auth.userId);
    return Response.json({ quote: quoteDto(quote), authors });
  });
}

// DELETE /api/notebook/quotes  { id } or { ids }
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.union([z.object({ id: objectId }), z.object({ ids: z.array(objectId).min(1).max(200) })]),
  );
  if (!body.ok) return body.response;

  return run("DELETE quotes", async () => {
    await connectToDB();
    const ids = "ids" in body.data ? body.data.ids : [body.data.id];
    const quotes = await NotebookQuote.find({ _id: { $in: ids }, user: auth.userId }).select("authorKey");
    if (!quotes.length) throw apiError(404, "Quote not found");
    await NotebookQuote.deleteMany({ _id: { $in: quotes.map((q) => q._id) } });
    await dropEmptyAuthors(auth.userId, quotes.map((q) => q.authorKey));
    const authors = await listAuthors(auth.userId);
    return Response.json({ deletedIds: quotes.map((q) => String(q._id)), authors });
  });
}
