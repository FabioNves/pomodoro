// Grounding validation: turns the model's structured answer into stories
// that are provably backed by retrieved articles.
//
// The model only ever references sources by id. Anything it wrote that does
// not resolve to a retrieved item is dropped; any URL it typed into prose is
// removed; quoted passages that do not appear in that item's own text lose
// their quotation marks so they read as paraphrase, not as a fabricated
// quote.

import { isRoundup } from "@/lib/news/kinds";

const URL_RE = /https?:\/\/[^\s)>\]"']+/gi;
const QUOTE_CHARS = /["“”]/g;
// Quoted runs shorter than this are terms and titles rather than attributed
// speech, so they keep their quotation marks.
const MIN_QUOTE_LEN = 15;

function norm(text) {
  return String(text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function clip(text, max) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/** Normalised text of some retrieved items, for verbatim checks. */
export function corpusOf(items) {
  return norm((items || []).map((c) => `${c.title || ""} ${c.snippet || ""} ${c.excerpt || ""}`).join(" "));
}

/**
 * Unquote passages that are not verbatim in the sources.
 *
 * Quote marks are paired in the order they appear (1st with 2nd, 3rd with
 * 4th, …) rather than matched by a regex. A regex lets the closing mark of
 * one quote pair with the opening mark of the next, so stripping that "quote"
 * would splice two genuine quotes and the words between them into a single
 * quotation nobody said.
 */
function sanitizeQuotes(text, corpus, warnings) {
  const positions = [];
  let match;
  QUOTE_CHARS.lastIndex = 0;
  while ((match = QUOTE_CHARS.exec(text))) positions.push(match.index);
  if (positions.length < 2) return text;

  const drop = [];
  for (let i = 0; i + 1 < positions.length; i += 2) {
    const open = positions[i];
    const close = positions[i + 1];
    const inner = text.slice(open + 1, close);
    if (inner.trim().length < MIN_QUOTE_LEN) continue;
    const needle = norm(inner);
    if (needle && corpus.includes(needle)) continue;
    drop.push(open, close);
  }
  if (!drop.length) return text;

  warnings.push("Removed quotation marks around wording not found verbatim in the sources.");
  let out = "";
  let prev = 0;
  for (const index of drop.sort((a, b) => a - b)) {
    out += text.slice(prev, index);
    prev = index + 1;
  }
  return out + text.slice(prev);
}

function sanitizeProse(text, corpus, warnings) {
  let value = String(text || "");
  const withoutUrls = value.replace(URL_RE, "");
  if (withoutUrls !== value) {
    value = withoutUrls.replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ");
    warnings.push("Removed a URL the model wrote into a summary.");
  }
  return sanitizeQuotes(value, corpus, warnings).trim();
}

function matchTopics(list, userTopics) {
  const byKey = new Map(userTopics.map((t) => [norm(t), t]));
  const out = [];
  for (const raw of list || []) {
    const hit = byKey.get(norm(raw));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

/**
 * New topics the reader could follow: short, plain, not already followed,
 * and actually named in the story's own sources.
 */
function cleanSuggestedTopics(list, userTopics, corpus, max = 2) {
  const followed = new Set(userTopics.map(norm));
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const value = String(raw || "").replace(/\s+/g, " ").trim();
    const key = norm(value);
    if (!key || value.length < 2 || value.length > 40) continue;
    if (/https?:\/\//i.test(value) || followed.has(key) || seen.has(key)) continue;
    if (!corpus.includes(key)) continue; // not mentioned by the sources
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * @param {object} params
 * @param {object} params.data          model output (daily or weekly schema)
 * @param {object[]} params.candidates  retrieval candidates with numeric ids
 * @param {"daily"|"weekly"|"custom"} params.kind
 * @param {number} params.storyCount
 * @param {boolean} params.includeWorthKnowing
 * @param {string[]} params.topics      the user's topic names
 */
export function groundBriefing({ data, candidates, kind, storyCount, includeWorthKnowing, topics }) {
  const warnings = [];
  const byId = new Map(candidates.map((c) => [c.id, c]));
  // Used for the framing text only; per-item prose is checked against the
  // sources that item actually cites.
  const allCorpus = corpusOf(candidates);
  let dropped = 0;

  const resolve = (ids) => {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(ids) ? ids : []) {
      const id = Number(raw);
      const c = byId.get(id);
      if (!c || seen.has(id)) continue;
      seen.add(id);
      out.push(c);
    }
    return out;
  };

  const usedPrimary = new Set();
  const buildStories = (list, section, limit) => {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
      if (out.length >= limit) break;
      const sources = resolve(raw?.sourceIds);
      if (!sources.length) {
        dropped += 1;
        continue;
      }
      const corpus = corpusOf(sources);
      const headline = clip(sanitizeProse(raw?.headline, corpus, warnings), 300);
      const summary = clip(sanitizeProse(raw?.summary, corpus, warnings), 3000);
      if (!headline || !summary) {
        dropped += 1;
        continue;
      }
      const primary = sources[0];
      if (usedPrimary.has(primary.key)) {
        dropped += 1;
        continue;
      }
      usedPrimary.add(primary.key);
      out.push({
        section,
        rank: out.length,
        headline,
        summary,
        whyItMatters: clip(sanitizeProse(raw?.whyItMatters, corpus, warnings), 2000),
        isAnalysis: Boolean(raw?.isAnalysis),
        topics: matchTopics(raw?.topics, topics),
        suggestedTopics: cleanSuggestedTopics(raw?.suggestedTopics, topics, corpus),
        primary,
        sources,
      });
    }
    return out;
  };

  const buildGrouped = (list, limit, minSources) => {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
      if (out.length >= limit) break;
      const sources = resolve(raw?.sourceIds);
      if (sources.length < minSources) {
        dropped += 1;
        continue;
      }
      const corpus = corpusOf(sources);
      const title = clip(sanitizeProse(raw?.title, corpus, warnings), 300);
      const summary = clip(sanitizeProse(raw?.summary, corpus, warnings), 2000);
      if (!title || !summary) {
        dropped += 1;
        continue;
      }
      out.push({ title, summary, sources });
    }
    return out;
  };

  const roundup = isRoundup(kind);
  const highlights = roundup ? buildGrouped(data.biggestDevelopments, 5, 1) : [];
  const top = buildStories(data.topStories, "top", storyCount);
  const worthKnowing = includeWorthKnowing ? buildStories(data.worthKnowing, "worthKnowing", 3) : [];
  const missed = roundup ? buildStories(data.missed, "missed", 4) : [];
  const trends = buildGrouped(data.trends, 4, 2);

  const stories = [...top, ...worthKnowing, ...missed];
  return {
    intro: clip(sanitizeProse(data.intro, allCorpus, warnings), 1000),
    note: clip(sanitizeProse(data.note, allCorpus, warnings), 1000),
    insufficient: Boolean(data.insufficientInformation),
    stories,
    highlights,
    trends,
    dropped,
    warnings: [...new Set(warnings)],
  };
}

/**
 * Keep only citations that resolve, strip dangling [n] markers, remove any
 * URL the model typed, and unquote wording that is not in the sources.
 */
export function groundAnswer({ data, sources }) {
  const warnings = [];
  const valid = new Set(sources.map((s) => s.id));
  const cited = [];
  let droppedCitations = 0;

  let answer = String(data.answer || "");
  answer = answer.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, inner) => {
    const all = inner.split(",").map((x) => Number(x.trim()));
    const ids = all.filter((id) => valid.has(id));
    droppedCitations += all.length - ids.length;
    if (!ids.length) return "";
    for (const id of ids) if (!cited.includes(id)) cited.push(id);
    return `[${ids.join(", ")}]`;
  });
  for (const id of (data.citations || []).map(Number)) {
    if (valid.has(id) && !cited.includes(id)) cited.push(id);
  }

  answer = answer.replace(URL_RE, "").replace(/\s{2,}/g, " ").trim();
  answer = sanitizeQuotes(answer, corpusOf(sources), warnings).trim();

  if (droppedCitations) {
    warnings.push(
      `${droppedCitations} reference${droppedCitations === 1 ? "" : "s"} in the answer did not match a retrieved source and ${droppedCitations === 1 ? "was" : "were"} removed. Treat the surrounding sentence as unverified.`,
    );
  }
  return {
    answer,
    citations: cited,
    insufficient: Boolean(data.insufficient),
    warnings: [...new Set(warnings)],
  };
}
