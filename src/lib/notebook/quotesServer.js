// Server-side helpers for the Quotes view: DTOs, the author records that
// quotes hang off, and the duplicate check applied when quotes are saved.
// Server only: imports the models.

import crypto from "crypto";
import NotebookQuote from "@/models/NotebookQuote";
import NotebookQuoteAuthor from "@/models/NotebookQuoteAuthor";
import { authorKey, normalizeQuoteText, UNKNOWN_AUTHOR } from "@/lib/notebook/quotes";

/* ── the "found on the page" proof ─────────────────────── */

// Only the suggest route can say a quote was found verbatim on a page it
// fetched, and the browser is what carries that answer back to the save
// route. So the suggest route signs the finding and the save route checks
// the signature: the badge cannot be claimed by a hand-made request, and a
// proof cannot be moved to different words, a different page or another user.
const PROOF_TTL_MS = 60 * 60 * 1000;

function proofSignature(userId, text, sourceUrl, exp) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET || "")
    .update(`notebook-quote:${userId}:${normalizeQuoteText(text)}:${sourceUrl}:${exp}`)
    .digest("base64url");
}

/** Token the suggest route attaches to a quote it checked against a page. */
export function issueQuoteProof(userId, { text, sourceUrl }) {
  const exp = Date.now() + PROOF_TTL_MS;
  return `${exp}.${proofSignature(userId, text, sourceUrl || "", exp)}`;
}

/** True when `proof` really was issued for these words and this page. */
export function verifyQuoteProof(userId, { text, sourceUrl, proof }) {
  if (!proof || !process.env.JWT_SECRET) return false;
  const [expText, sig] = String(proof).split(".");
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;
  const expected = Buffer.from(proofSignature(userId, text, sourceUrl || "", exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function quoteDto(quote) {
  return {
    id: String(quote._id),
    text: quote.text,
    author: quote.author,
    authorKey: quote.authorKey,
    source: quote.source || "",
    sourceUrl: quote.sourceUrl || "",
    origin: quote.origin || "manual",
    verified: !!quote.verified,
    active: quote.active !== false,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

export function authorDto(author, count = 0) {
  return {
    name: author.name,
    key: author.key,
    active: author.active !== false,
    count,
  };
}

/** Every author of the user with the number of quotes each has. */
export async function listAuthors(userId) {
  const [authors, counts] = await Promise.all([
    NotebookQuoteAuthor.find({ user: userId }).sort({ name: 1 }),
    NotebookQuote.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$authorKey", count: { $sum: 1 } } },
    ]),
  ]);
  const countOf = new Map(counts.map((c) => [c._id, c.count]));
  return authors.map((a) => authorDto(a, countOf.get(a.key) || 0));
}

/** The author record for a name, created (active) when it does not exist yet. */
export async function ensureAuthor(userId, name) {
  const clean = String(name || "").replace(/\s+/g, " ").trim() || UNKNOWN_AUTHOR;
  const key = authorKey(clean) || authorKey(UNKNOWN_AUTHOR);
  const existing = await NotebookQuoteAuthor.findOne({ user: userId, key });
  if (existing) return existing;
  try {
    return await NotebookQuoteAuthor.create({ user: userId, name: clean, key, active: true });
  } catch (error) {
    if (error?.code === 11000) return NotebookQuoteAuthor.findOne({ user: userId, key });
    throw error;
  }
}

/** Removes author records that no longer have any quote. */
export async function dropEmptyAuthors(userId, keys) {
  const wanted = [...new Set(keys.filter(Boolean))];
  if (!wanted.length) return;
  const still = await NotebookQuote.distinct("authorKey", { user: userId, authorKey: { $in: wanted } });
  const gone = wanted.filter((k) => !still.includes(k));
  if (gone.length) await NotebookQuoteAuthor.deleteMany({ user: userId, key: { $in: gone } });
}

/**
 * Saves the quotes that are not already in the notebook (same author, same
 * words). Returns the created quotes and how many were skipped.
 *
 * `verified` is never taken from an item: it is earned by a valid `proof`
 * from the suggest route, so a browser cannot award the badge to anything.
 */
export async function saveQuotes(userId, items) {
  const created = [];
  let skipped = 0;
  const seenNow = new Set();
  const authors = new Map();
  const existingByAuthor = new Map();

  for (const item of items) {
    const key = authorKey(item.author) || authorKey(UNKNOWN_AUTHOR);
    const textKey = normalizeQuoteText(item.text);
    if (!textKey) {
      skipped += 1;
      continue;
    }
    const dupKey = `${key}\n${textKey}`;
    if (seenNow.has(dupKey)) {
      skipped += 1;
      continue;
    }
    if (!existingByAuthor.has(key)) {
      const rows = await NotebookQuote.find({ user: userId, authorKey: key }).select("text");
      existingByAuthor.set(key, new Set(rows.map((r) => normalizeQuoteText(r.text))));
    }
    if (existingByAuthor.get(key).has(textKey)) {
      skipped += 1;
      continue;
    }
    seenNow.add(dupKey);
    if (!authors.has(key)) authors.set(key, await ensureAuthor(userId, item.author));
    const author = authors.get(key);
    const quote = await NotebookQuote.create({
      user: userId,
      text: item.text,
      author: author.name,
      authorKey: author.key,
      source: item.source || "",
      sourceUrl: item.sourceUrl || "",
      origin: item.origin || "manual",
      verified: verifyQuoteProof(userId, item),
      active: item.active !== false,
    });
    created.push(quote);
  }
  return { created, skipped };
}
