// Turns raw MCP tool results into a small, provider-independent shape:
//   search: [{ title, url, key, domain, publisher, snippet, publishedAt,
//              publishedAtSource, score }]
//   fetch:  { text, title }
//
// MCP servers return tool output as text blocks (sometimes JSON, sometimes a
// "Title: / URL: / Content:" listing) or as structuredContent. All three are
// handled, and anything that does not carry a valid http(s) URL is dropped.

import { nationalPublisher } from "@/lib/news/locales";

const TRACKING_PARAMS = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|yclid|_ga|_gl|ref|ref_src|ref_url|source|s|si|spm|cmpid|ocid|smid|sr_share|share_type)$/i;

const PUBLISHERS = {
  "apnews.com": "AP News",
  "reuters.com": "Reuters",
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "nytimes.com": "The New York Times",
  "washingtonpost.com": "The Washington Post",
  "theguardian.com": "The Guardian",
  "ft.com": "Financial Times",
  "wsj.com": "The Wall Street Journal",
  "bloomberg.com": "Bloomberg",
  "cnbc.com": "CNBC",
  "cnn.com": "CNN",
  "economist.com": "The Economist",
  "theverge.com": "The Verge",
  "techcrunch.com": "TechCrunch",
  "arstechnica.com": "Ars Technica",
  "wired.com": "WIRED",
  "engadget.com": "Engadget",
  "venturebeat.com": "VentureBeat",
  "theinformation.com": "The Information",
  "axios.com": "Axios",
  "zdnet.com": "ZDNet",
  "infoq.com": "InfoQ",
  "thenewstack.io": "The New Stack",
  "news.ycombinator.com": "Hacker News",
  "github.com": "GitHub",
  "github.blog": "GitHub Blog",
  "openai.com": "OpenAI",
  "anthropic.com": "Anthropic",
  "deepmind.google": "Google DeepMind",
  "blog.google": "Google",
  "developers.googleblog.com": "Google Developers",
  "microsoft.com": "Microsoft",
  "blogs.microsoft.com": "Microsoft",
  "nextjs.org": "Next.js",
  "vercel.com": "Vercel",
  "react.dev": "React",
  "nodejs.org": "Node.js",
  "arxiv.org": "arXiv",
  "nature.com": "Nature",
  "science.org": "Science",
  "sciencedaily.com": "ScienceDaily",
  "spectrum.ieee.org": "IEEE Spectrum",
  "technologyreview.com": "MIT Technology Review",
  "hbr.org": "Harvard Business Review",
  "forbes.com": "Forbes",
  "businessinsider.com": "Business Insider",
  "theregister.com": "The Register",
  "9to5mac.com": "9to5Mac",
  "macrumors.com": "MacRumors",
  "ign.com": "IGN",
  "polygon.com": "Polygon",
  "kotaku.com": "Kotaku",
  "eurogamer.net": "Eurogamer",
  "gamesindustry.biz": "GamesIndustry.biz",
  "sec.gov": "U.S. SEC",
  "europa.eu": "European Union",
  "whitehouse.gov": "The White House",
  "gov.uk": "UK Government",
};

/**
 * Drop punctuation that prose left stuck to a link. A ")" is only punctuation
 * when it does not close a "(" belonging to the URL itself, so links like
 * en.wikipedia.org/wiki/Foo_(bar) survive intact.
 */
function trimTrailingPunctuation(value) {
  let out = value;
  while (out.length) {
    const last = out[out.length - 1];
    if (last === ")") {
      const opens = (out.match(/\(/g) || []).length;
      const closes = (out.match(/\)/g) || []).length;
      if (closes <= opens) break;
    } else if (!"]>,.;'\"".includes(last)) {
      break;
    }
    out = out.slice(0, -1);
  }
  return out;
}

export function canonicalizeUrl(raw) {
  if (typeof raw !== "string") return null;
  let value = trimTrailingPunctuation(raw.trim());
  if (!/^https?:\/\//i.test(value)) return null;
  let u;
  try {
    u = new URL(value);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  for (const name of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(name)) u.searchParams.delete(name);
  }
  u.searchParams.sort();
  const hostKey = u.hostname.replace(/^www\./, "");
  const pathKey = u.pathname.replace(/\/+$/, "") || "/";
  const query = u.searchParams.toString();
  return {
    url: u.toString(),
    key: `${hostKey}${pathKey}${query ? `?${query}` : ""}`,
    domain: hostKey,
  };
}

export function publisherFromDomain(domain) {
  if (!domain) return "";
  if (PUBLISHERS[domain]) return PUBLISHERS[domain];
  const parts = domain.split(".");
  // blog.example.com -> example.com
  for (let i = 1; i < parts.length - 1; i += 1) {
    const parent = parts.slice(i).join(".");
    if (PUBLISHERS[parent]) return PUBLISHERS[parent];
  }
  // National outlets of the regional editions ("publico.pt" -> "Público").
  return nationalPublisher(domain) || domain;
}

// "3 hours ago" in the languages editions search in. Search providers
// localise relative ages when asked for a non-English market.
const RELATIVE_UNITS = [
  [/^(min|minute|minuto|minute|minuti|minuut|minuten|minuto)/i, 60000],
  [/^(h|hr|hour|hora|heure|ora|ore|stunde|uur)/i, 3600000],
  [/^(d|day|dia|día|jour|giorn|tag|dag)/i, 86400000],
  [/^(w|week|semana|semaine|settiman|woche|wek)/i, 7 * 86400000],
  [/^(mo|month|m[eê]s|mois|mes|monat|maand)/i, 30 * 86400000],
  [/^(y|year|ano|año|an|ann|jahr|jaar)/i, 365 * 86400000],
];

function relativeAge(text) {
  const patterns = [
    /^(\d+)\s*([a-zà-ÿ]+)\s+(?:ago|atr[aá]s)$/i, // en, pt "3 horas atrás"
    /^(?:h[aá]|hace|il y a|vor)\s+(\d+)\s*([a-zà-ÿ]+)$/i, // pt, es, fr, de
    /^(\d+)\s*([a-zà-ÿ]+)\s+(?:fa|geleden)$/i, // it, nl
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const unit = RELATIVE_UNITS.find(([re]) => re.test(m[2]));
    if (unit) return plausible(new Date(Date.now() - Number(m[1]) * unit[1]));
  }
  return null;
}

const MIN_YEAR = 2000;

function plausible(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < MIN_YEAR || date.getTime() > Date.now() + 2 * 86400000) return null;
  return date;
}

/** A publication date encoded in the URL path, e.g. /2026/09/10/slug. */
export function dateFromUrl(url) {
  if (typeof url !== "string") return null;
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  let m = path.match(/\/(20\d{2})[/-](0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])(?:[/-]|$)/);
  if (!m) m = path.match(/\/(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[/-]|$)/);
  if (!m) return null;
  return plausible(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)));
}

/** ISO / RFC dates, plus "3 hours ago" style relative strings. */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return plausible(value);
  if (typeof value === "number") {
    return plausible(new Date(value < 1e12 ? value * 1000 : value));
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  const rel = text.match(/^(\d+)\s*(minute|min|hour|hr|day|week|month|year)s?\s+ago$/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms =
      unit.startsWith("min") ? n * 60000
      : unit.startsWith("h") ? n * 3600000
      : unit.startsWith("d") ? n * 86400000
      : unit.startsWith("w") ? n * 7 * 86400000
      : unit.startsWith("mo") ? n * 30 * 86400000
      : n * 365 * 86400000;
    return plausible(new Date(Date.now() - ms));
  }
  const localised = relativeAge(text);
  if (localised) return localised;
  if (/^(today|just now|hoje|hoy|aujourd'hui|oggi|heute|vandaag)$/i.test(text)) return plausible(new Date());
  if (/^(yesterday|ontem|ayer|hier|ieri|gestern|gisteren)$/i.test(text)) return plausible(new Date(Date.now() - 86400000));
  const parsed = new Date(text);
  return plausible(parsed);
}

function pick(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

const TITLE_KEYS = ["title", "name", "headline", "pageTitle"];
const URL_KEYS = ["url", "link", "href", "source_url", "sourceUrl", "uri", "id"];
const SNIPPET_KEYS = ["content", "snippet", "description", "text", "summary", "excerpt", "body", "highlights"];
const DATE_KEYS = ["published_date", "publishedDate", "published_at", "publishedAt", "published", "datePublished", "date", "pubDate", "page_age", "age", "timestamp"];
const SCORE_KEYS = ["score", "relevance", "relevance_score"];

function mapRecord(record) {
  if (!record || typeof record !== "object") return null;
  const url = pick(record, URL_KEYS);
  const canon = canonicalizeUrl(typeof url === "string" ? url : "");
  if (!canon) return null;
  let snippet = pick(record, SNIPPET_KEYS);
  if (Array.isArray(snippet)) snippet = snippet.join(" ");
  const rawDate = pick(record, DATE_KEYS);
  const metaDate = parseDate(rawDate);
  const urlDate = metaDate ? null : dateFromUrl(canon.url);
  const scoreRaw = pick(record, SCORE_KEYS);
  return {
    title: cleanLine(String(pick(record, TITLE_KEYS) || "")),
    url: canon.url,
    key: canon.key,
    domain: canon.domain,
    publisher: publisherFromDomain(canon.domain),
    snippet: cleanText(typeof snippet === "string" ? snippet : "", 1200),
    publishedAt: metaDate || urlDate || null,
    publishedAtSource: metaDate ? "metadata" : urlDate ? "url" : "",
    score: typeof scoreRaw === "number" ? scoreRaw : Number(scoreRaw) || 0,
  };
}

function arrayFrom(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return null;
  for (const key of ["results", "items", "data", "organic", "hits", "documents", "articles", "news", "web", "value"]) {
    const value = json[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && Array.isArray(value.results)) return value.results;
  }
  return null;
}

function tryJson(text) {
  const trimmed = text.trim();
  if (!/^[[{]/.test(trimmed)) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function textBlocks(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  return content
    .filter((c) => c && c.type === "text" && typeof c.text === "string")
    .map((c) => c.text);
}

// "Title: …\nURL: …\nContent: …" listings, as emitted by several servers.
function parseLabeledText(text) {
  const blocks = text.split(/\n(?=\s*(?:\d+[.)]\s*)?(?:\*\*)?Title(?:\*\*)?:\s*)/i);
  const items = [];
  for (const block of blocks) {
    if (!/Title\s*:/i.test(block)) continue;
    const grab = (label) => {
      const m = block.match(new RegExp(`(?:^|\\n)\\s*(?:\\*\\*)?${label}(?:\\*\\*)?:\\s*([^\\n]*)`, "i"));
      return m ? m[1].trim() : "";
    };
    const url = grab("URL") || grab("Link") || grab("Source");
    const rawContent = block.match(/(?:^|\n)\s*(?:\*\*)?Raw Content(?:\*\*)?:\s*([\s\S]*)$/i);
    const content = grab("Content") || grab("Description") || grab("Snippet") || grab("Summary");
    items.push({
      title: grab("Title"),
      url,
      content: content || (rawContent ? rawContent[1] : ""),
      published_date: grab("Published Date") || grab("Published") || grab("Date") || grab("Age"),
      score: grab("Score"),
    });
  }
  return items;
}

// "[title](url)" markdown links or bare URLs with the preceding line as title.
function parseLooseText(text) {
  const items = [];
  const seen = new Set();
  const md = /\[([^\]]{3,200})\]\((https?:\/\/[^)\s]+)\)/g;
  let m;
  while ((m = md.exec(text))) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    items.push({ title: m[1], url: m[2] });
  }
  if (items.length) return items;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const hit = lines[i].match(/https?:\/\/[^\s)>"']+/);
    if (!hit || seen.has(hit[0])) continue;
    seen.add(hit[0]);
    const before = lines.slice(Math.max(0, i - 2), i).map((l) => l.trim()).filter(Boolean);
    const after = lines.slice(i + 1, i + 3).map((l) => l.trim()).filter(Boolean);
    items.push({
      title: before[before.length - 1] || "",
      url: hit[0],
      content: after.join(" "),
    });
  }
  return items;
}

/**
 * Normalise a search tool result.
 * @returns {{ items: object[], warnings: string[] }}
 */
export function parseSearchResult(result) {
  const warnings = [];
  const records = [];

  const structured = arrayFrom(result?.structuredContent);
  if (structured) records.push(...structured);

  if (!records.length) {
    for (const text of textBlocks(result)) {
      const json = tryJson(text);
      const fromJson = json ? arrayFrom(json) : null;
      if (fromJson) {
        records.push(...fromJson);
        continue;
      }
      if (json && typeof json === "object" && pick(json, URL_KEYS)) {
        records.push(json);
        continue;
      }
      if (json) {
        // Structured, but held no results. Scraping URLs out of the raw text
        // would turn an error body's support link into a "source".
        continue;
      }
      const labeled = parseLabeledText(text);
      if (labeled.length) {
        records.push(...labeled);
        continue;
      }
      const loose = parseLooseText(text);
      if (loose.length) {
        records.push(...loose);
        warnings.push("Search results were parsed from unstructured text.");
      }
    }
  }

  const items = [];
  const seen = new Set();
  for (const record of records) {
    const item = mapRecord(record);
    if (!item || seen.has(item.key)) continue;
    seen.add(item.key);
    items.push(item);
  }
  if (!items.length && (records.length || textBlocks(result).join("").trim())) {
    warnings.push("Search tool returned content but no usable URLs.");
  }
  return { items, warnings };
}

/**
 * Normalise a page-fetch tool result into text.
 * @returns {{ text: string, title: string }}
 */
export function parseFetchResult(result, { maxChars = 8000 } = {}) {
  let text = "";
  let title = "";

  const sc = result?.structuredContent;
  if (sc && typeof sc === "object") {
    const first = arrayFrom(sc)?.[0] || sc;
    text = String(pick(first, ["raw_content", "rawContent", "content", "text", "markdown", "html"]) || "");
    title = String(pick(first, TITLE_KEYS) || "");
  }

  if (!text) {
    for (const block of textBlocks(result)) {
      const json = tryJson(block);
      if (json) {
        const first = arrayFrom(json)?.[0] || json;
        const candidate = pick(first, ["raw_content", "rawContent", "content", "text", "markdown", "html"]);
        if (typeof candidate === "string" && candidate.trim()) {
          text = candidate;
          title = String(pick(first, TITLE_KEYS) || "");
          break;
        }
        // The block was structured but carried no page text (typically a
        // per-URL failure such as {"error":"..."} or an empty results list).
        // Returning the payload itself would feed the model a fake article.
        continue;
      }
      const rawMatch = block.match(/(?:^|\n)\s*(?:\*\*)?Raw Content(?:\*\*)?:\s*([\s\S]*)$/i);
      const contentMatch = block.match(/(?:^|\n)\s*(?:\*\*)?Content(?:\*\*)?:\s*([\s\S]*)$/i);
      const titleMatch = block.match(/(?:^|\n)\s*(?:\*\*)?Title(?:\*\*)?:\s*([^\n]*)/i);
      if (titleMatch) title = titleMatch[1].trim();
      const body = rawMatch ? rawMatch[1] : contentMatch ? contentMatch[1] : block;
      if (body && body.trim()) {
        text = body;
        break;
      }
    }
  }

  return { text: cleanText(text, maxChars), title: cleanLine(title) };
}

export function cleanLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

/** Collapse whitespace, drop markdown images and script-like noise. */
export function cleanText(value, maxChars = 8000) {
  let text = String(value || "");
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " "); // images
  text = text.replace(/<[^>]{1,200}>/g, " "); // stray html tags
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
  if (text.length > maxChars) text = `${text.slice(0, maxChars).trimEnd()}…`;
  return text;
}
