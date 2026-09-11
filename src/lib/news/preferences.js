// News preferences: defaults, validation and the small helpers shared by the
// preferences, topics and generation code. Server only (imports models).

import { z } from "zod";
import NewsPreference from "@/models/NewsPreference";
import NewsTopic from "@/models/NewsTopic";

export const SUGGESTED_TOPICS = [
  "AI",
  "AI agents",
  "OpenAI",
  "Anthropic",
  "Next.js",
  "React",
  "Startups",
  "SaaS",
  "Technology",
  "Programming",
  "Productivity",
  "Finance",
  "Science",
  "Gaming",
];

export const MAX_TOPICS = 30;
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
  })
  .partial()
  .strict();

export const topicNameSchema = z.string().trim().min(1).max(80);

export async function getOrCreatePreferences(userId, { timezoneHint } = {}) {
  const existing = await NewsPreference.findOne({ user: userId });
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
  return pref;
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
    createdAt: topic.createdAt,
  };
}

/** Create a topic if the user does not already follow it. */
export async function followTopic(userId, name, { source = "manual" } = {}) {
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
    const topic = await NewsTopic.create({ user: userId, name: clean, key, source });
    return { topic, created: true };
  } catch (error) {
    if (error?.code === 11000) {
      return { topic: await NewsTopic.findOne({ user: userId, key }), created: false };
    }
    throw error;
  }
}
