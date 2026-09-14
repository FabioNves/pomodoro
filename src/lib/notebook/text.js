// Plain-text helpers for notebook content: text extraction, word counts,
// [[wiki links]] and the server-side hardening of stored HTML. Pure
// functions, imported by both the API routes and the browser.

const BLOCK_BREAK =
  /<\/(p|div|li|h[1-6]|blockquote|pre|tr|section|article)>|<br\s*\/?>|<hr\s*\/?>/gi;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const n =
        code[1]?.toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000
        ? String.fromCodePoint(n)
        : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** The readable text of an HTML fragment, one line per block. */
export function htmlToText(html) {
  if (!html) return "";
  return decodeEntities(
    String(html)
      .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(BLOCK_BREAK, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function countWords(text) {
  const trimmed = String(text || "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

const WIKI_LINK = /\[\[([^[\]\n]{1,200})\]\]/g;

/** Titles referenced as [[Title]] or [[Title|alias]], first spelling wins. */
export function extractWikiLinks(text) {
  const seen = new Map();
  for (const match of String(text || "").matchAll(WIKI_LINK)) {
    const title = match[1].split("|")[0].trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (!seen.has(key)) seen.set(key, title);
  }
  return [...seen.values()];
}

export function previewOf(text, max = 240) {
  const flat = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

const CONTAINER_TAGS = "script|style|iframe|object|embed|form|svg|math|template";

/**
 * Server-side hardening of stored HTML. The browser sanitises properly
 * (src/lib/notebook/sanitize.js, allow-list based); this only removes the few
 * things that could execute if a client ever skipped that step.
 */
export function stripDangerousHtml(html) {
  return String(html || "")
    .replace(new RegExp(`<(${CONTAINER_TAGS})\\b[\\s\\S]*?<\\/\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\/?(${CONTAINER_TAGS}|link|meta|base)\\b[^>]*>`, "gi"), "")
    .replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /(href|src|action|formaction|xlink:href)\s*=\s*(["']?)\s*(javascript|data|vbscript):[^"'\s>]*\2/gi,
      "$1=$2#$2",
    );
}
