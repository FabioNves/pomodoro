// Countries and languages for regional briefing editions.
//
// Shared by the browser (settings dropdowns, language tabs) and the server
// (search arguments, source scoring, publisher names). Pure data and pure
// functions only: nothing here touches the database or the network.
//
// Providers name places differently, so both forms live here. Brave takes an
// ISO 3166-1 alpha-2 code ("PT") and its own language codes ("pt-pt"); Tavily
// takes the full English country name ("Portugal") and has no language field.

import { SELECTABLE_KINDS } from "@/lib/news/kinds";

/** Editions a reader may keep. Each one is a full search pass per run. */
export const MAX_EDITIONS = 12;

export const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "nb", name: "Norwegian", native: "Norsk" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "zh", name: "Chinese", native: "中文" },
];

// code: ISO 3166-1 alpha-2, as Brave expects. name: full English name, as
// Tavily expects. languages: what news there is mostly written in, first one
// used when a country is picked without a language. tld: the country-code
// domain its outlets tend to use ("" when there is no single one).
export const COUNTRIES = [
  { code: "PT", name: "Portugal", languages: ["pt"], tld: "pt" },
  { code: "BR", name: "Brazil", languages: ["pt"], tld: "br" },
  { code: "ES", name: "Spain", languages: ["es"], tld: "es" },
  { code: "MX", name: "Mexico", languages: ["es"], tld: "mx" },
  { code: "AR", name: "Argentina", languages: ["es"], tld: "ar" },
  { code: "FR", name: "France", languages: ["fr"], tld: "fr" },
  { code: "BE", name: "Belgium", languages: ["nl", "fr"], tld: "be" },
  { code: "CH", name: "Switzerland", languages: ["de", "fr", "it"], tld: "ch" },
  { code: "IT", name: "Italy", languages: ["it"], tld: "it" },
  { code: "DE", name: "Germany", languages: ["de"], tld: "de" },
  { code: "AT", name: "Austria", languages: ["de"], tld: "at" },
  { code: "NL", name: "Netherlands", languages: ["nl"], tld: "nl" },
  { code: "GB", name: "United Kingdom", languages: ["en"], tld: "uk" },
  { code: "US", name: "United States", languages: ["en"], tld: "" },
  { code: "CA", name: "Canada", languages: ["en", "fr"], tld: "ca" },
  { code: "AU", name: "Australia", languages: ["en"], tld: "au" },
  { code: "IN", name: "India", languages: ["en"], tld: "in" },
  { code: "PL", name: "Poland", languages: ["pl"], tld: "pl" },
  { code: "SE", name: "Sweden", languages: ["sv"], tld: "se" },
  { code: "DK", name: "Denmark", languages: ["da"], tld: "dk" },
  { code: "FI", name: "Finland", languages: ["fi"], tld: "fi" },
  { code: "NO", name: "Norway", languages: ["nb"], tld: "no" },
  { code: "TR", name: "Turkey", languages: ["tr"], tld: "tr" },
  { code: "JP", name: "Japan", languages: ["ja"], tld: "jp" },
  { code: "KR", name: "South Korea", languages: ["ko"], tld: "kr" },
  { code: "CN", name: "China", languages: ["zh"], tld: "cn" },
];

/** The country an edition for a language covers unless the reader changes it. */
export const DEFAULT_COUNTRY_FOR_LANGUAGE = {
  en: "GB",
  pt: "PT",
  es: "ES",
  fr: "FR",
  it: "IT",
  de: "DE",
  nl: "NL",
  pl: "PL",
  sv: "SE",
  da: "DK",
  fi: "FI",
  nb: "NO",
  tr: "TR",
  ja: "JP",
  ko: "KR",
  zh: "CN",
};

// Established national outlets, by country. Listing one lifts it above an
// unknown site in that country's edition and gives it a proper display name
// ("Público" rather than "publico.pt"). Global outlets such as Reuters are
// already trusted everywhere, so they appear here only where they are also
// the national reference.
export const NATIONAL_OUTLETS = {
  PT: {
    "publico.pt": "Público",
    "expresso.pt": "Expresso",
    "observador.pt": "Observador",
    "rtp.pt": "RTP",
    "dn.pt": "Diário de Notícias",
    "jn.pt": "Jornal de Notícias",
    "eco.sapo.pt": "ECO",
    "jornaldenegocios.pt": "Jornal de Negócios",
    "lusa.pt": "Lusa",
    "sicnoticias.pt": "SIC Notícias",
  },
  ES: {
    "elpais.com": "El País",
    "elmundo.es": "El Mundo",
    "lavanguardia.com": "La Vanguardia",
    "rtve.es": "RTVE",
    "abc.es": "ABC",
    "expansion.com": "Expansión",
    "eldiario.es": "elDiario.es",
    "efe.com": "EFE",
    "elconfidencial.com": "El Confidencial",
  },
  FR: {
    "lemonde.fr": "Le Monde",
    "lefigaro.fr": "Le Figaro",
    "liberation.fr": "Libération",
    "francetvinfo.fr": "franceinfo",
    "lesechos.fr": "Les Échos",
    "afp.com": "AFP",
    "la-croix.com": "La Croix",
    "rfi.fr": "RFI",
    "france24.com": "France 24",
  },
  IT: {
    "corriere.it": "Corriere della Sera",
    "repubblica.it": "la Repubblica",
    "lastampa.it": "La Stampa",
    "ansa.it": "ANSA",
    "ilsole24ore.com": "Il Sole 24 Ore",
    "rainews.it": "RaiNews",
    "ilpost.it": "Il Post",
  },
  DE: {
    "tagesschau.de": "tagesschau",
    "spiegel.de": "DER SPIEGEL",
    "zeit.de": "ZEIT ONLINE",
    "faz.net": "FAZ",
    "sueddeutsche.de": "Süddeutsche Zeitung",
    "handelsblatt.com": "Handelsblatt",
    "dw.com": "DW",
    "welt.de": "WELT",
  },
  NL: {
    "nos.nl": "NOS",
    "nrc.nl": "NRC",
    "volkskrant.nl": "de Volkskrant",
    "telegraaf.nl": "De Telegraaf",
    "trouw.nl": "Trouw",
    "fd.nl": "Het Financieele Dagblad",
    "ad.nl": "AD",
    "nu.nl": "NU.nl",
  },
  GB: {
    "bbc.co.uk": "BBC",
    "bbc.com": "BBC",
    "theguardian.com": "The Guardian",
    "ft.com": "Financial Times",
    "thetimes.co.uk": "The Times",
    "telegraph.co.uk": "The Telegraph",
    "independent.co.uk": "The Independent",
    "news.sky.com": "Sky News",
    "reuters.com": "Reuters",
  },
  US: {
    "nytimes.com": "The New York Times",
    "washingtonpost.com": "The Washington Post",
    "wsj.com": "The Wall Street Journal",
    "apnews.com": "AP News",
    "npr.org": "NPR",
    "cnn.com": "CNN",
    "bloomberg.com": "Bloomberg",
    "axios.com": "Axios",
    "politico.com": "Politico",
  },
  BR: {
    "folha.uol.com.br": "Folha de S.Paulo",
    "oglobo.globo.com": "O Globo",
    "g1.globo.com": "g1",
    "estadao.com.br": "Estadão",
  },
  BE: {
    "lesoir.be": "Le Soir",
    "standaard.be": "De Standaard",
    "vrt.be": "VRT",
    "rtbf.be": "RTBF",
  },
  AT: {
    "derstandard.at": "DER STANDARD",
    "orf.at": "ORF",
    "diepresse.com": "Die Presse",
  },
  CH: {
    "nzz.ch": "NZZ",
    "srf.ch": "SRF",
    "letemps.ch": "Le Temps",
    "rts.ch": "RTS",
  },
};

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
const LANGUAGE_BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));
const LANGUAGE_INDEX = new Map(LANGUAGES.map((l, i) => [l.code, i]));

export function countryByCode(code) {
  return COUNTRY_BY_CODE.get(String(code || "").toUpperCase()) || null;
}

export function languageByCode(code) {
  return LANGUAGE_BY_CODE.get(String(code || "").toLowerCase()) || null;
}

export function countryName(code) {
  return countryByCode(code)?.name || "";
}

export function languageName(code) {
  return languageByCode(code)?.name || "";
}

export function isKnownCountry(code) {
  return Boolean(countryByCode(code));
}

export function isKnownLanguage(code) {
  return Boolean(code) && Boolean(languageByCode(code));
}

/**
 * Language keys in the order LANGUAGES lists them, with "" (no single
 * language) last. Used for the saved-stories tabs.
 */
export function sortLanguageKeys(keys) {
  return [...keys].sort((a, b) => {
    const ia = a ? (LANGUAGE_INDEX.get(a) ?? 500) : 1000;
    const ib = b ? (LANGUAGE_INDEX.get(b) ?? 500) : 1000;
    return ia - ib || String(a).localeCompare(String(b));
  });
}

/**
 * Brave's `search_lang` value for a language. Brave splits Portuguese and
 * English by region and uses its own codes for Japanese and Chinese.
 */
export function braveSearchLang(language, country) {
  const lang = String(language || "").toLowerCase();
  const cc = String(country || "").toUpperCase();
  if (!lang) return "";
  if (lang === "pt") return cc === "BR" ? "pt-br" : "pt-pt";
  if (lang === "en") return cc === "GB" ? "en-gb" : "en";
  if (lang === "ja") return "jp";
  if (lang === "zh") return "zh-hans";
  return lang;
}

function domainMatches(domain, outlet) {
  return domain === outlet || domain.endsWith(`.${outlet}`);
}

/** Display name of a national outlet, or "" when the domain is not listed. */
export function nationalPublisher(domain) {
  const d = String(domain || "").toLowerCase();
  if (!d) return "";
  for (const outlets of Object.values(NATIONAL_OUTLETS)) {
    if (outlets[d]) return outlets[d];
  }
  for (const outlets of Object.values(NATIONAL_OUTLETS)) {
    for (const [outlet, name] of Object.entries(outlets)) {
      if (domainMatches(d, outlet)) return name;
    }
  }
  return "";
}

/** True when the domain is a listed national outlet of one of these countries. */
export function isNationalOutlet(domain, countries = []) {
  const d = String(domain || "").toLowerCase();
  return countries.some((code) => {
    const outlets = NATIONAL_OUTLETS[String(code).toUpperCase()];
    return outlets ? Object.keys(outlets).some((outlet) => domainMatches(d, outlet)) : false;
  });
}

/** True when the domain sits under one of these countries' top-level domains. */
export function hasCountryTld(domain, countries = []) {
  const d = String(domain || "").toLowerCase();
  return countries.some((code) => {
    const tld = countryByCode(code)?.tld;
    return tld ? d.endsWith(`.${tld}`) : false;
  });
}

/**
 * The language an edition is written in: its translation target when it has
 * one, otherwise the language its news is in, otherwise the reader's own.
 */
export function outputLanguageOf(edition, userLanguage = "en") {
  const fallback = isKnownLanguage(userLanguage) ? userLanguage : "en";
  if (edition?.output && edition.output !== "source" && isKnownLanguage(edition.output)) {
    return edition.output;
  }
  return isKnownLanguage(edition?.language) ? edition.language : fallback;
}

/** A short, collision-resistant key for a new edition. */
export function newEditionKey() {
  return `ed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ── which briefings an edition runs in ────────────────────────────── */

/** The briefing kinds this edition runs in, cleaned up. */
export function editionKinds(edition) {
  const list = Array.isArray(edition?.kinds) ? edition.kinds : [];
  const clean = new Set();
  for (const kind of list) {
    const key = String(kind).toLowerCase();
    if (SELECTABLE_KINDS.includes(key)) clean.add(key);
  }
  return SELECTABLE_KINDS.filter((k) => clean.has(k));
}

/**
 * The editions a run of this kind uses. A custom-schedule briefing is a
 * daily one on chosen days, so it uses the daily editions.
 */
export function editionsForKind(editions, kind) {
  const wanted = kind === "custom" ? "daily" : kind;
  return normalizeEditionList(editions).filter((e) => editionKinds(e).includes(wanted));
}

/** What identifies an edition as "the same" apart from its schedule. */
function editionIdentity(edition) {
  return [
    [...(edition?.countries || [])].map((c) => String(c).toUpperCase()).sort().join("+"),
    String(edition?.language || ""),
    String(edition?.output || "source"),
    edition?.coverage === "top" ? "top" : "topics",
  ].join("|");
}

/**
 * A list of editions, from either the current shape (one list, each edition
 * naming the kinds it runs in) or the first one (a list per kind). Editions
 * that only differed by kind become one edition running in both.
 */
export function normalizeEditionList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((e) => (e && typeof e.toObject === "function" ? e.toObject() : e)).filter(Boolean);
  }
  if (!raw || typeof raw !== "object") return [];

  const source = typeof raw.toObject === "function" ? raw.toObject() : raw;
  const byIdentity = new Map();
  for (const kind of SELECTABLE_KINDS) {
    for (const edition of source[kind] || []) {
      const plain = edition && typeof edition.toObject === "function" ? edition.toObject() : edition;
      if (!plain) continue;
      const id = editionIdentity(plain);
      const existing = byIdentity.get(id);
      if (existing) {
        if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
        continue;
      }
      byIdentity.set(id, { ...plain, key: plain.key || newEditionKey(), kinds: [kind] });
    }
  }
  return [...byIdentity.values()];
}

/**
 * One edition per language, each covering the top news of that language's
 * main country. `output` is "source" to keep every edition in its own
 * language, or a language code to translate them all into it; `kinds` says
 * which briefings they run in.
 */
export function editionsForLanguages(languages, { output = "source", kinds = ["weekly"] } = {}) {
  const runsIn = editionKinds({ kinds });
  return [...new Set(languages)].filter(isKnownLanguage).map((language) => {
    const country = DEFAULT_COUNTRY_FOR_LANGUAGE[language] || "";
    return {
      key: newEditionKey(),
      countries: country ? [country] : [],
      language,
      // Translating an edition into the language it is already in is a no-op.
      output: output === language ? "source" : output,
      coverage: "top",
      kinds: runsIn,
    };
  });
}
