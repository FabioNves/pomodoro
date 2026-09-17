import { z } from "zod";
import { connectToDB } from "@/lib/db";
import NotebookQuote from "@/models/NotebookQuote";
import NotebookQuoteAuthor from "@/models/NotebookQuoteAuthor";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { SIGN_IN, run, apiError } from "@/lib/notebook/server";
import { QUOTE_LIMITS, authorKey, UNKNOWN_AUTHOR } from "@/lib/notebook/quotes";
import { listAuthors, quoteDto } from "@/lib/notebook/quotesServer";

const authorName = z.string().trim().min(1).max(QUOTE_LIMITS.author);

// A name of nothing but punctuation ("???") normalises to "", and
// ensureAuthor() files it under "unknown"; look it up the same way, or the
// row could never be paused, renamed or deleted.
const keyOf = (name) => authorKey(name) || authorKey(UNKNOWN_AUTHOR);

// PATCH /api/notebook/quotes/authors  { name, active?, newName? }
// Pauses or resumes an author (their quotes leave or rejoin the dashboard
// slot machine) or renames them, which renames every quote they have.
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({ name: authorName, active: z.boolean().optional(), newName: authorName.optional() }),
  );
  if (!body.ok) return body.response;

  return run("PATCH quote authors", async () => {
    await connectToDB();
    const { name, active, newName } = body.data;
    const author = await NotebookQuoteAuthor.findOne({ user: auth.userId, key: keyOf(name) });
    if (!author) throw apiError(404, "Author not found");

    if (active !== undefined) author.active = active;
    let quotes = null;
    if (newName !== undefined) {
      const key = authorKey(newName);
      if (!key) throw apiError(400, "Give the author a name with letters in it");
      if (key !== author.key) {
        const clash = await NotebookQuoteAuthor.findOne({ user: auth.userId, key });
        if (clash) throw apiError(400, `You already have an author called "${clash.name}"`);
      }
      author.name = newName.replace(/\s+/g, " ").trim();
      const previousKey = author.key;
      author.key = key;
      await author.save();
      await NotebookQuote.updateMany(
        { user: auth.userId, authorKey: previousKey },
        { $set: { author: author.name, authorKey: key } },
      );
      quotes = await NotebookQuote.find({ user: auth.userId, authorKey: key }).sort({ createdAt: -1 });
    } else {
      await author.save();
    }
    const authors = await listAuthors(auth.userId);
    return Response.json({
      author: authors.find((a) => a.key === author.key) || null,
      authors,
      ...(quotes ? { quotes: quotes.map(quoteDto) } : {}),
    });
  });
}

// DELETE /api/notebook/quotes/authors  { name }  — the author and every quote.
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ name: authorName }));
  if (!body.ok) return body.response;

  return run("DELETE quote authors", async () => {
    await connectToDB();
    const key = keyOf(body.data.name);
    const author = await NotebookQuoteAuthor.findOne({ user: auth.userId, key });
    if (!author) throw apiError(404, "Author not found");
    const quotes = await NotebookQuote.find({ user: auth.userId, authorKey: key }).select("_id");
    await NotebookQuote.deleteMany({ user: auth.userId, authorKey: key });
    await NotebookQuoteAuthor.deleteOne({ _id: author._id });
    const authors = await listAuthors(auth.userId);
    return Response.json({ deletedQuoteIds: quotes.map((q) => String(q._id)), authors });
  });
}
