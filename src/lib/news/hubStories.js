// The news hub's daily and weekly stories, as one reader sees them. Server
// only.
//
// The hub (movez-studio) writes them every morning per language and topic
// from its publisher feeds, each with the real articles it came from. Here
// they are read per edition of the reader (its language and regions), kept
// to the hub topics the reader follows (NewsPreference.hubTopics, empty =
// all) and offered in the reader's language on request. No AI runs per
// reader except a translation, which is made once per story and language.

import { hubStories, hubTopics } from "@/lib/newsHub/client";
import { chatJson } from "@/lib/ai/openai";
import HubStoryTranslation from "@/models/HubStoryTranslation";
import { normalizeEditionList, languageName } from "@/lib/news/locales";

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await fn();
  if (value?.ok) {
    if (cache.size > 300) cache.clear();
    cache.set(key, { at: Date.now(), value });
  }
  return value;
}

/** The hub's topics (cached), `[{ key, name, subtopics }]`; [] without a hub. */
export async function listHubTopics() {
  const res = await cached("topics", () => hubTopics());
  return res.ok ? res.topics : [];
}

/**
 * The stories of a period for each of the reader's editions. An edition
 * without a language reads the reader's own; one without countries reads
 * the whole language.
 * @returns {Promise<{ editions: object[], error: string | null }>}
 */
export async function loadHubStories(pref, { period = "daily", key = "latest" } = {}) {
  const editions = normalizeEditionList(pref.editions);
  const list = editions.length ? editions : [{ key: "main", countries: [], language: "" }];
  const topics = [...(pref.hubTopics || [])].sort();
  let error = null;
  const out = await Promise.all(
    list.map(async (e) => {
      const language = e.language || pref.language || "en";
      const countries = [...(e.countries || [])].sort();
      const res = await cached(`${period}|${key}|${language}|${countries}|${topics}`, () =>
        hubStories({ period, key, languages: [language], countries, topics }),
      );
      if (!res.ok) {
        error = res.error?.message || "The news hub could not be reached.";
        return { key: e.key, language, countries, periodKey: null, digests: [] };
      }
      return { key: e.key, language, countries, periodKey: res.periodKey, digests: res.digests };
    }),
  );
  return { editions: out, error };
}

const str = (description) => ({ type: "string", description });

/**
 * A hub story in `language`, made once and shared. `story` is what the
 * reader sees (the hub's text); returns `{ headline, summary, whyItMatters }`.
 */
export async function translateHubStory(story, language) {
  const existing = await HubStoryTranslation.findOne({ story: story.id, language }).lean();
  if (existing) return existing;
  const { data } = await chatJson({
    system: `Translate a short news story into ${languageName(language) || language}. Translate faithfully and naturally; keep names as they are; add nothing.`,
    user: `Headline: ${story.headline}\n\nSummary: ${story.summary}\n\nWhy it matters: ${story.whyItMatters || ""}`,
    schema: {
      type: "object",
      properties: { headline: str("The headline."), summary: str("The summary."), whyItMatters: str("Why it matters, or empty.") },
      required: ["headline", "summary", "whyItMatters"],
      additionalProperties: false,
    },
    schemaName: "story_translation",
    maxTokens: 1500,
    timeoutMs: 45000,
    retries: 1,
  });
  const doc = {
    story: story.id,
    language,
    headline: String(data.headline || "").slice(0, 300),
    summary: String(data.summary || "").slice(0, 2000),
    whyItMatters: String(data.whyItMatters || "").slice(0, 600),
    expiresAt: new Date(Date.now() + 120 * 86400000),
  };
  await HubStoryTranslation.updateOne({ story: story.id, language }, { $setOnInsert: doc }, { upsert: true });
  return doc;
}
