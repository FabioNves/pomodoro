// AI quote suggestions for the notebook's Quotes view. Server only.
//
// Two modes. With MATERIAL (pages retrieved through MCP, see
// src/lib/notebook/quoteResearch.js) the model only extracts quotes that
// appear in it and cites the item id; the caller then checks every quote
// verbatim against that item before marking it verified. Without material
// the model answers from memory, and everything it returns is flagged
// unverified so the user knows to check it.

import { chatJson, AiError, isOpenAiConfigured } from "@/lib/ai/openai";
import { QUOTE_LIMITS, cleanQuoteText, normalizeQuoteText } from "@/lib/notebook/quotes";

export { AiError, isOpenAiConfigured };

const QUOTES_SCHEMA = {
  type: "object",
  properties: {
    quotes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The quotation, exact wording, without surrounding quotation marks.",
          },
          source: {
            type: "string",
            description: "Work, speech, interview or letter it comes from, with the year when known; empty when unknown.",
          },
          sourceId: {
            type: "integer",
            description: "Id of the MATERIAL item the quote was copied from; 0 when there is no material.",
          },
        },
        required: ["text", "source", "sourceId"],
        additionalProperties: false,
      },
    },
  },
  required: ["quotes"],
  additionalProperties: false,
};

const QUOTES_SYSTEM = `You collect quotations by a named author for someone's personal notebook.

Rules:
- Only return words the author actually said or wrote. Skip lines commonly misattributed to them on the internet; when unsure, leave it out. Fewer accurate quotes beat a padded list.
- Keep the exact wording. Never paraphrase, shorten or "improve" a quote. No surrounding quotation marks in the text field.
- One quote per item, at most 60 words each; prefer ones that stand on their own.
- Do not repeat quotes listed as already saved, and do not return near-duplicates of each other.
- "source" names the work, speech, interview or letter (and the year when known) in a few words. Leave it empty when you do not know it. Never invent a source.
- When MATERIAL is provided: take quotes only from it, copy them verbatim, and set sourceId to the id of the item they appear in. Ignore the material's own commentary, adverts and navigation text. Do not add quotes from memory.
- Without material, sourceId is 0.
- Language: keep each quote in the language it is given in the material, or, from memory, in the language the author is best known in. If the request asks for a particular language, translate faithfully into it instead.
- A theme or instructions from the user narrow the selection; follow them.
- When a WORK is named (a book, essay, speech or film), take quotes only from that work, and set "source" to it. If you do not know the work well enough to quote it exactly, return nothing rather than guessing; lines from the author's other writing do not belong here.`;

const clean = (s, max) => cleanQuoteText(s).slice(0, max);

/**
 * @param {object} params
 * @param {string} params.author
 * @param {string} [params.work]   Book, essay or speech to quote from.
 * @param {string} [params.topic]  Theme or free-form instructions.
 * @param {number} [params.count]
 * @param {string[]} [params.existing]  Quotes already saved, to skip.
 * @param {{ id: number, title: string, url: string, domain: string, text: string }[]} [params.material]
 * @returns {Promise<{ quotes: { text, author, source, sourceUrl, sourceId, verified }[], model: string }>}
 */
export async function suggestQuotes({ author, work = "", topic = "", count = 8, existing = [], material = [], deadlineAt = null }) {
  const wanted = Math.max(1, Math.min(QUOTE_LIMITS.suggestions, Math.round(count) || 8));
  const title = work?.trim() ? clean(work, QUOTE_LIMITS.source) : "";
  const lines = [
    `Author: ${clean(author, QUOTE_LIMITS.author)}`,
    `Work: ${title || "(any)"}`,
    `Theme or instructions: ${topic?.trim() ? clean(topic, 300) : "(none)"}`,
    `Wanted: up to ${wanted} quotes.`,
  ];
  if (existing.length) {
    lines.push(`Already saved (do not repeat):\n${existing.slice(0, 60).map((q) => `- ${clean(q, 200)}`).join("\n")}`);
  }
  if (material.length) {
    lines.push(
      `MATERIAL (${material.length} items):\n\n${material
        .map((m) => `[${m.id}] ${m.title || "(untitled)"} — ${m.domain || m.url}\n${m.text}`)
        .join("\n\n")}`,
    );
  } else {
    lines.push("No material is provided: answer from memory, and only with quotes you are confident are genuinely theirs.");
  }

  const { data, model } = await chatJson({
    system: QUOTES_SYSTEM,
    user: lines.join("\n\n"),
    schema: QUOTES_SCHEMA,
    schemaName: "quote_suggestions",
    maxTokens: 3000,
    timeoutMs: 60000,
    // The rate limit on a small OpenAI account is the usual reason this
    // fails, and it clears in seconds, so it is worth waiting out.
    retries: 3,
    deadlineAt,
  });

  const byId = new Map(material.map((m) => [m.id, m]));
  const seen = new Set();
  const quotes = [];
  for (const raw of Array.isArray(data.quotes) ? data.quotes : []) {
    const text = clean(raw?.text, QUOTE_LIMITS.text);
    const key = normalizeQuoteText(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const item = byId.get(Number(raw?.sourceId)) || null;
    // Verbatim check: the quote must appear in the cited item (or, failing
    // that, in any item) before it counts as verified.
    let found = item && normalizeQuoteText(item.text).includes(key) ? item : null;
    if (!found && material.length) found = material.find((m) => normalizeQuoteText(m.text).includes(key)) || null;
    quotes.push({
      text,
      author: clean(author, QUOTE_LIMITS.author),
      // A quote from a named work belongs to it unless the model said more.
      source: clean(raw?.source, QUOTE_LIMITS.source) || title,
      sourceUrl: found?.url || "",
      sourceId: found?.id || 0,
      verified: Boolean(found),
    });
    if (quotes.length >= wanted) break;
  }
  return { quotes, model };
}
