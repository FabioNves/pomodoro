// News preferences: defaults, validation and the small helpers shared by the
// preferences, topics and generation code. Server only (imports models).

import { z } from "zod";
import NewsPreference from "@/models/NewsPreference";
import NewsTopic from "@/models/NewsTopic";
import {
  MAX_EDITIONS,
  editionKinds,
  isKnownCountry,
  isKnownLanguage,
  newEditionKey,
  normalizeEditionList,
} from "@/lib/news/locales";

export { SUGGESTED_TOPICS, SUGGESTED_TOPIC_GROUPS } from "@/lib/news/topicSuggestions";

export const MAX_TOPICS = 60;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Normalised form of a topic used for de-duplication ("AI Agents" == "ai agents"). */
export function topicKey(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim();
}

export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz.trim() || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const dayNumber = z.number().int().min(0).max(6);

const editionInput = z.object({
  key: z.string().trim().min(1).max(40),
  countries: z
    .array(z.string().trim().toUpperCase().refine(isKnownCountry, "Unknown country"))
    .max(8)
    .default([]),
  language: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || isKnownLanguage(v), "Unknown language")
    .default(""),
  output: z
    .string()
    .trim()
    .refine((v) => v === "source" || isKnownLanguage(v), "Unknown output language")
    .default("source"),
  coverage: z.enum(["topics", "top"]).default("topics"),
  // The briefings this edition runs in. Empty is allowed: the edition is
  // kept, but no run builds it.
  kinds: z.array(z.enum(["daily", "weekly", "monthly"])).max(3).default(["daily"]),
});

export const preferencesUpdateSchema = z
  .object({
    timezone: z.string().trim().refine(isValidTimeZone, "Unknown timezone"),
    daily: z.object({ enabled: z.boolean(), time: z.string().regex(TIME_RE, "Use HH:MM") }).partial(),
    weekly: z
      .object({ enabled: z.boolean(), day: dayNumber, time: z.string().regex(TIME_RE, "Use HH:MM") })
      .partial(),
    monthly: z
      .object({
        enabled: z.boolean(),
        day: z.number().int().min(1).max(31),
        time: z.string().regex(TIME_RE, "Use HH:MM"),
      })
      .partial(),
    custom: z
      .object({
        enabled: z.boolean(),
        days: z.array(dayNumber).max(7),
        time: z.string().regex(TIME_RE, "Use HH:MM"),
      })
      .partial(),
    customInterests: z.string().max(1000),
    storyCount: z.number().int().min(3).max(15),
    briefingLength: z.enum(["short", "medium", "long"]),
    majorNewsOnly: z.boolean(),
    includeWorthKnowing: z.boolean(),
    language: z.string().trim().toLowerCase().refine(isKnownLanguage, "Unknown language"),
    editions: z.array(editionInput).max(MAX_EDITIONS),
  })
  .partial()
  .strict();

export const topicNameSchema = z.string().trim().min(1).max(80);

/**
 * Rewrite editions stored in the first shape (one list per briefing kind)
 * as the current one (one list, each edition naming its kinds). Done through
 * the raw collection, because the document no longer fits the schema.
 * @returns {Promise<boolean>} whether anything was rewritten
 */
async function migrateLegacyEditions(userId) {
  const raw = await NewsPreference.collection.findOne({ user: userId }, { projection: { editions: 1 } });
  if (!raw || raw.editions === undefined || Array.isArray(raw.editions)) return false;
  await NewsPreference.collection.updateOne(
    { _id: raw._id },
    { $set: { editions: normalizeEditionList(raw.editions) } },
  );
  return true;
}

/**
 * Editions that cannot have been written by this code.
 *
 * Mongoose does not refuse the old shape: it casts `{daily: [...], ...}` into
 * a single array entry whose fields are all unknown, so the mistake shows up
 * as an edition without a key rather than as an error. Every edition this app
 * writes is given one.
 */
function looksLegacy(pref) {
  const editions = pref?.editions;
  if (!Array.isArray(editions)) return true;
  return editions.some((e) => !e?.key);
}

export async function getOrCreatePreferences(userId, { timezoneHint } = {}) {
  let existing = await NewsPreference.findOne({ user: userId });
  if (existing && looksLegacy(existing)) {
    // Saved before editions became one list: convert it through the raw
    // collection and read it back, so nothing later saves the bad cast.
    if (await migrateLegacyEditions(userId)) {
      existing = await NewsPreference.findOne({ user: userId });
    }
  }
  if (existing) return { pref: existing, created: false };

  // First use. Two requests can arrive together (the page loads preferences
  // and status at once), so create through an upsert: whoever loses the race
  // reads the winner's document instead of hitting the unique index.
  const timezone = isValidTimeZone(timezoneHint) ? timezoneHint : "UTC";
  try {
    const pref = await NewsPreference.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId, timezone } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { pref, created: true };
  } catch (error) {
    if (error?.code === 11000) {
      const pref = await NewsPreference.findOne({ user: userId });
      if (pref) return { pref, created: false };
    }
    throw error;
  }
}

/** Keys identify an edition, so a duplicated one gets a suffix. */
function uniqueKeys(list) {
  const seen = new Set();
  return list.map((edition, index) => {
    let key = edition.key || newEditionKey();
    for (let n = 1; seen.has(key); n += 1) key = `${String(edition.key).slice(0, 30)}-${index}-${n}`;
    seen.add(key);
    return {
      ...edition,
      key,
      countries: [...new Set(edition.countries)],
      kinds: editionKinds(edition),
    };
  });
}

/** Apply a validated partial update to a preferences document (in place). */
export function applyPreferenceUpdate(pref, update) {
  if (update.timezone !== undefined) pref.timezone = update.timezone;
  for (const key of ["daily", "weekly", "monthly", "custom"]) {
    if (update[key]) {
      const current = pref[key]?.toObject ? pref[key].toObject() : { ...(pref[key] || {}) };
      const next = { ...current, ...update[key] };
      if (key === "custom" && Array.isArray(next.days)) {
        next.days = [...new Set(next.days)].sort((a, b) => a - b);
      }
      pref[key] = next;
    }
  }
  for (const key of ["customInterests", "storyCount", "briefingLength", "majorNewsOnly", "includeWorthKnowing"]) {
    if (update[key] !== undefined) pref[key] = update[key];
  }
  if (update.language !== undefined) pref.language = update.language;
  if (update.editions) pref.editions = uniqueKeys(update.editions);
  return pref;
}

function editionsDto(list) {
  return normalizeEditionList(list).map((e) => ({
    key: e.key,
    countries: [...(e.countries || [])],
    language: e.language || "",
    output: e.output || "source",
    coverage: e.coverage === "top" ? "top" : "topics",
    kinds: editionKinds(e),
  }));
}

export function preferencesDto(pref) {
  return {
    timezone: pref.timezone,
    daily: { enabled: Boolean(pref.daily?.enabled), time: pref.daily?.time || "07:00" },
    weekly: {
      enabled: Boolean(pref.weekly?.enabled),
      day: typeof pref.weekly?.day === "number" ? pref.weekly.day : 1,
      time: pref.weekly?.time || "08:00",
    },
    monthly: {
      enabled: Boolean(pref.monthly?.enabled),
      day: typeof pref.monthly?.day === "number" ? pref.monthly.day : 1,
      time: pref.monthly?.time || "08:00",
    },
    custom: {
      enabled: Boolean(pref.custom?.enabled),
      days: Array.isArray(pref.custom?.days) ? pref.custom.days : [],
      time: pref.custom?.time || "07:00",
    },
    customInterests: pref.customInterests || "",
    storyCount: pref.storyCount ?? 7,
    briefingLength: pref.briefingLength || "medium",
    majorNewsOnly: Boolean(pref.majorNewsOnly),
    includeWorthKnowing: pref.includeWorthKnowing !== false,
    language: isKnownLanguage(pref.language) ? pref.language : "en",
    editions: editionsDto(pref.editions),
    updatedAt: pref.updatedAt || null,
  };
}

export async function listTopics(userId) {
  return NewsTopic.find({ user: userId }).sort({ weight: -1, createdAt: 1 }).lean();
}

export function topicDto(topic) {
  return {
    id: String(topic._id),
    name: topic.name,
    source: topic.source,
    weight: topic.weight,
    // Empty means every edition.
    editions: [...(topic.editions || [])],
    createdAt: topic.createdAt,
  };
}

/** Edition keys a topic may be limited to, cleaned up. */
export function cleanTopicEditions(editions) {
  if (!Array.isArray(editions)) return [];
  return [...new Set(editions.map((k) => String(k).trim()).filter(Boolean))].slice(0, MAX_EDITIONS);
}

/** Limit a topic to these editions (empty for every edition). */
export async function setTopicEditions(userId, id, editions) {
  const topic = await NewsTopic.findOneAndUpdate(
    { _id: id, user: userId },
    { $set: { editions: cleanTopicEditions(editions) } },
    { new: true },
  );
  if (!topic) {
    const error = new Error("Topic not found");
    error.status = 404;
    throw error;
  }
  return topic;
}

/** Create a topic if the user does not already follow it. */
export async function followTopic(userId, name, { source = "manual", editions = [] } = {}) {
  const clean = topicNameSchema.parse(name);
  const key = topicKey(clean);
  if (!key) {
    // e.g. "!!!" — passes the length check but normalises to nothing.
    const error = new Error("That topic name has no letters or numbers.");
    error.status = 400;
    throw error;
  }
  const existing = await NewsTopic.findOne({ user: userId, key });
  if (existing) return { topic: existing, created: false };
  const count = await NewsTopic.countDocuments({ user: userId });
  if (count >= MAX_TOPICS) {
    const error = new Error(`You can follow up to ${MAX_TOPICS} topics.`);
    error.status = 400;
    throw error;
  }
  try {
    const topic = await NewsTopic.create({
      user: userId,
      name: clean,
      key,
      source,
      editions: cleanTopicEditions(editions),
    });
    return { topic, created: true };
  } catch (error) {
    if (error?.code === 11000) {
      return { topic: await NewsTopic.findOne({ user: userId, key }), created: false };
    }
    throw error;
  }
}
