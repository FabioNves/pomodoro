// Server-side helpers for the Personal Budget API: validation, DTOs, the
// settings every reader starts with and the entries of repeating ones.
// Server only: it imports the models. categories.js, engine.js and
// repeat.js are shared with the browser.

import { z } from "zod";
import BudgetSettings from "@/models/BudgetSettings";
import BudgetSeries from "@/models/BudgetSeries";
import BudgetEntry from "@/models/BudgetEntry";
import {
  BUDGET_CURRENCIES,
  BUDGET_LIMITS,
  DEFAULT_CATEGORIES,
  DEFAULT_CURRENCY,
  ENTRY_TYPE_KEYS,
  KIND_KEYS,
  kindFor,
} from "./categories";
import { MONTH_RE, addMonths, daysInMonth, monthKeyOf, monthsBetween } from "./engine";
import {
  ISO_DATE_RE,
  REPEAT_LIMITS,
  dayBefore,
  isoOf,
  normalizeDays,
  occDate,
  occurrencesIn,
} from "./repeat";

export const SIGN_IN = { signInMessage: "Sign in to use your budget.", feature: "budget" };

/* ── validation ────────────────────────────────────────── */

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
export const monthKey = z.string().regex(MONTH_RE, "Use a month like 2026-10");
export const entryType = z.enum(ENTRY_TYPE_KEYS);
// Checked against the entry's type with kindFor(), which falls back to the
// type's first kind.
export const entryKind = z.enum(KIND_KEYS);
export { kindFor };
export const currency = z.enum(BUDGET_CURRENCIES);
export const title = z.string().trim().min(1, "Give the entry a name").max(BUDGET_LIMITS.title);
export const note = z.string().trim().max(BUDGET_LIMITS.note);
export const amount = z
  .number()
  .finite()
  .min(0, "The amount cannot be negative")
  .max(BUDGET_LIMITS.amount)
  .transform((n) => Math.round(n * 100) / 100);
export const day = z.number().int().min(1).max(31).nullable();
export const categoryKey = z.string().trim().min(1).max(60);
export const categoryLabel = z.string().trim().min(1, "Give the category a name").max(BUDGET_LIMITS.categoryLabel);

/** Throwable error that `run()` turns into a JSON response. */
export function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Runs a route body, mapping apiError() to its status and anything else to 500. */
export async function run(label, fn) {
  try {
    return await fn();
  } catch (error) {
    if (error?.status && error.status < 500) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(`[budget] ${label} failed`, error);
    return Response.json({ error: "Something went wrong in your budget." }, { status: 500 });
  }
}

/* ── DTOs ──────────────────────────────────────────────── */

export function settingsDto(settings) {
  return {
    currency: settings.currency || DEFAULT_CURRENCY,
    categories: (settings.categories || []).map((c) => ({
      key: c.key,
      label: c.label,
      type: c.type,
      custom: Boolean(c.custom),
    })),
  };
}

export function entryDto(entry) {
  return {
    id: String(entry._id),
    type: entry.type,
    title: entry.title,
    amount: entry.amount,
    category: entry.category,
    kind: kindFor(entry.type, entry.kind),
    note: entry.note || "",
    month: entry.month,
    payMonth: entry.payMonth,
    payDay: entry.payDay ?? null,
    day: entry.day ?? null,
    done: Boolean(entry.done),
    doneAt: entry.doneAt || null,
    projected: Boolean(entry.projected),
    projectedAmount: entry.projectedAmount ?? null,
    series: entry.series ? String(entry.series) : null,
    occ: entry.occ || null,
  };
}

/* ── settings ──────────────────────────────────────────── */

/** The reader's settings, created with the default categories the first time. */
export async function ensureSettings(userId) {
  return BudgetSettings.findOneAndUpdate(
    { user: userId },
    {
      $setOnInsert: {
        user: userId,
        currency: DEFAULT_CURRENCY,
        categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, custom: false })),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/* ── repeating entries ─────────────────────────────────── */

/** A repeat rule as the routes take it. The start is set by the route. */
export const repeatRule = z.object({
  interval: z.number().int().min(1).max(REPEAT_LIMITS.interval),
  days: z.array(z.number().int().min(1).max(31)).max(REPEAT_LIMITS.days),
  endDate: z.string().regex(ISO_DATE_RE, "Use a date like 2027-12-31").nullable().optional(),
});

export function seriesDto(series) {
  return {
    id: String(series._id),
    interval: series.interval || 1,
    days: normalizeDays(series.days),
    startDate: series.startDate,
    endDate: series.endDate || null,
  };
}

/** The template fields a series copies into every occurrence. */
export function templateOf(source) {
  return {
    type: source.type,
    title: source.title,
    amount: source.amount,
    category: source.category,
    kind: kindFor(source.type, source.kind),
    note: source.note || "",
    projected: source.type === "income" && Boolean(source.projected),
  };
}

/** The key of an entry's occurrence: its date, or its month when undated. */
export function occOfEntry(entry) {
  return entry.day ? isoOf(entry.month, entry.day) : entry.month;
}

let migrated = null;

/**
 * Brings series and entries from before repeat rules up to date, once per
 * server process: a series gets its rule from `day`/`startMonth`/`endMonth`,
 * an entry of a series its `occ`, and the old one-per-month index goes (two
 * occurrences can now share a month).
 */
export function migrateBudget() {
  migrated ||= (async () => {
    await BudgetEntry.collection.dropIndex("series_1_month_1").catch(() => {});
    const old = await BudgetSeries.find({ startDate: null }).lean();
    if (old.length) {
      await BudgetSeries.bulkWrite(
        old.map((s) => ({
          updateOne: {
            filter: { _id: s._id },
            update: {
              $set: {
                interval: 1,
                days: s.day ? [s.day] : [],
                startDate: `${s.startMonth || monthKeyOf()}-01`,
                endDate: s.endMonth ? isoOf(s.endMonth, daysInMonth(s.endMonth)) : null,
              },
            },
          },
        })),
      );
    }
    const loose = await BudgetEntry.find({ series: { $ne: null }, occ: null }).select("month day").lean();
    if (loose.length) {
      await BudgetEntry.bulkWrite(
        loose.map((e) => ({ updateOne: { filter: { _id: e._id }, update: { $set: { occ: occOfEntry(e) } } } })),
      );
    }
  })().catch((error) => {
    migrated = null; // try again on the next request
    throw error;
  });
  return migrated;
}

/**
 * Makes the entry of every occurrence of the reader's repeating entries in
 * the given months, once. Months more than BUDGET_LIMITS.monthsAhead ahead
 * are left alone, so looking at a far year does not fill it in. A removed
 * occurrence keeps a `skipped` entry, which stops it coming back here.
 */
export async function materializeSeries(userId, months) {
  await migrateBudget();
  const limit = addMonths(monthKeyOf(), BUDGET_LIMITS.monthsAhead);
  const wanted = months.filter((m) => monthsBetween(m, limit) >= 0).sort();
  if (!wanted.length) return;
  const first = wanted[0];
  const last = wanted[wanted.length - 1];
  const series = await BudgetSeries.find({
    user: userId,
    startDate: { $lte: isoOf(last, 31) },
    $or: [{ endDate: null }, { endDate: { $gte: `${first}-01` } }],
  }).lean();
  if (!series.length) return;

  const ops = [];
  for (const s of series) {
    const template = templateOf(s);
    for (const month of wanted) {
      for (const { occ, day } of occurrencesIn(s, month)) {
        ops.push({
          updateOne: {
            filter: { series: s._id, occ },
            update: {
              $setOnInsert: {
                user: userId,
                ...template,
                month,
                day,
                payMonth: month,
                payDay: null,
                done: false,
                doneAt: null,
                projectedAmount: null,
                series: s._id,
                occ,
                skipped: false,
              },
            },
            upsert: true,
          },
        });
      }
    }
  }
  if (!ops.length) return;
  try {
    await BudgetEntry.bulkWrite(ops, { ordered: false });
  } catch (error) {
    // Two requests filling in the same occurrence at once: the unique index
    // keeps one entry and the other insert is refused. Anything else is real.
    if (error?.code !== 11000 && !error?.writeErrors?.every?.((w) => w.code === 11000)) throw error;
  }
}

/** Entries that belong to, or count in, any of the given months. */
export async function entriesFor(userId, months) {
  await materializeSeries(userId, months);
  const rows = await BudgetEntry.find({
    user: userId,
    skipped: { $ne: true },
    $or: [{ month: { $in: months } }, { payMonth: { $in: months } }],
  })
    .sort({ month: 1, day: 1, createdAt: 1 })
    .lean();
  return rows.map(entryDto);
}

/** The rules of the series those entries come from. */
export async function seriesFor(userId, entries) {
  const ids = [...new Set(entries.map((e) => e.series).filter(Boolean))];
  if (!ids.length) return [];
  const rows = await BudgetSeries.find({ user: userId, _id: { $in: ids } }).lean();
  return rows.map(seriesDto);
}

/** A new series with this template and rule, starting on `startDate`. */
export async function startSeries(userId, template, rule, startDate) {
  return BudgetSeries.create({
    user: userId,
    ...templateOf(template),
    interval: rule.interval,
    days: normalizeDays(rule.days),
    startDate,
    endDate: rule.endDate || null,
  });
}

/**
 * Ends a series just before the occurrence `occ`: it repeats up to the day
 * before, and its later entries that are not done (and the skipped ones) go,
 * except `keepId`. A series left with nothing before `occ` is deleted, its
 * remaining entries kept as one-time ones.
 */
export async function endSeriesBefore(series, occ, keepId = null) {
  await BudgetEntry.deleteMany({
    series: series._id,
    occ: { $gte: occ },
    $or: [{ done: false }, { skipped: true }],
    ...(keepId ? { _id: { $ne: keepId } } : {}),
  });
  const endDate = dayBefore(occDate(occ));
  if (endDate < series.startDate) {
    await BudgetEntry.updateMany({ series: series._id }, { $set: { series: null, occ: null } });
    await series.deleteOne();
    return null;
  }
  series.endDate = endDate;
  await series.save();
  return series;
}

/**
 * Makes `entry` the first occurrence of `series` in its own month, on or
 * after the series' start. Returns false when the rule has none there (the
 * entry then stays as it is).
 */
export function linkToSeries(entry, series) {
  const first = occurrencesIn(series, entry.month)[0];
  if (!first) return false;
  entry.series = series._id;
  entry.occ = first.occ;
  entry.day = first.day;
  return true;
}
