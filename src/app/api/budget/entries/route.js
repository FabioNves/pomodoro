import { z } from "zod";
import { connectToDB } from "@/lib/db";
import BudgetEntry from "@/models/BudgetEntry";
import BudgetSeries from "@/models/BudgetSeries";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { BUDGET_LIMITS } from "@/lib/budget/categories";
import { daysInMonth, monthsBetween } from "@/lib/budget/engine";
import { normalizeDays, occDate } from "@/lib/budget/repeat";
import {
  SIGN_IN,
  objectId,
  monthKey,
  entryType,
  entryKind,
  kindFor,
  title,
  note,
  amount,
  day,
  categoryKey,
  repeatRule,
  run,
  apiError,
  ensureSettings,
  entryDto,
  materializeSeries,
  migrateBudget,
  occOfEntry,
  startSeries,
  endSeriesBefore,
  linkToSeries,
  templateOf,
} from "@/lib/budget/server";

async function assertCategory(userId, type, key) {
  const settings = await ensureSettings(userId);
  if (!settings.categories.some((c) => c.key === key && c.type === type)) {
    throw apiError(400, "Choose one of the budget's categories.");
  }
}

function assertEnd(rule, start) {
  if (rule.endDate && rule.endDate < start) throw apiError(400, "The end date is before the first one.");
}

const sameRule = (series, rule) =>
  (series.interval || 1) === rule.interval &&
  normalizeDays(series.days).join(",") === normalizeDays(rule.days).join(",");

/**
 * Gives `entry` the repeat rule `rule` (null: no longer repeating), from this
 * entry on. Earlier entries keep the rule they were made with:
 * - a new interval or new days start a new series on this entry's date and
 *   end the old one the day before;
 * - only a new end date changes the series itself and drops what falls after;
 * - no rule ends the series before this entry, which becomes a one-time one.
 * Changes `entry` in memory; the caller saves it.
 */
async function applyRepeat(userId, entry, rule) {
  const series = entry.series ? await BudgetSeries.findOne({ _id: entry.series, user: userId }) : null;
  const occ = entry.series && entry.occ ? entry.occ : occOfEntry(entry);

  if (rule === null) {
    if (series) await endSeriesBefore(series, occ, entry._id);
    entry.series = null;
    entry.occ = null;
    return;
  }

  const start = occDate(occ);
  assertEnd(rule, start);
  if (series && sameRule(series, rule)) {
    series.endDate = rule.endDate || null;
    await series.save();
    if (series.endDate) {
      await BudgetEntry.deleteMany({
        series: series._id,
        occ: { $gt: series.endDate },
        $or: [{ done: false }, { skipped: true }],
        _id: { $ne: entry._id },
      });
    }
    return;
  }

  const next = await startSeries(userId, templateOf(entry), rule, start);
  if (series) await endSeriesBefore(series, occ, entry._id);
  if (!linkToSeries(entry, next)) {
    // The new rule has nothing left this month: this one stays on its own
    // and the series starts at its next run.
    entry.series = null;
    entry.occ = null;
  }
}

// POST /api/budget/entries
// { type, title, amount, category, month, kind?, day?, note?, projected?, repeat? }
// `kind`: bill or debt for an expense, investment or saving for money put aside.
// `repeat` ({ interval, days, endDate? }, see src/lib/budget/repeat.js) makes
// a BudgetSeries from the start of that month instead of one entry; its
// occurrences of the month are made at once, later ones when looked at.
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      type: entryType,
      title,
      amount,
      category: categoryKey,
      month: monthKey,
      kind: entryKind.optional(),
      day: day.optional(),
      note: note.optional(),
      projected: z.boolean().optional(),
      repeat: repeatRule.nullable().optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST budget entry", async () => {
    await connectToDB();
    const d = body.data;
    await assertCategory(auth.userId, d.type, d.category);
    const count = await BudgetEntry.countDocuments({ user: auth.userId, month: d.month });
    if (count >= BUDGET_LIMITS.entriesPerMonth) {
      throw apiError(400, `A month can hold up to ${BUDGET_LIMITS.entriesPerMonth} entries.`);
    }
    const fields = {
      user: auth.userId,
      type: d.type,
      title: d.title,
      amount: d.amount,
      category: d.category,
      kind: kindFor(d.type, d.kind),
      note: d.note || "",
      projected: d.type === "income" && Boolean(d.projected),
    };

    if (d.repeat) {
      const start = `${d.month}-01`;
      assertEnd(d.repeat, start);
      await migrateBudget();
      const series = await startSeries(auth.userId, fields, d.repeat, start);
      await materializeSeries(auth.userId, [d.month]);
      const entries = await BudgetEntry.find({ series: series._id }).lean();
      return Response.json({ entries: entries.map(entryDto), seriesId: String(series._id) }, { status: 201 });
    }

    const entry = await BudgetEntry.create({ ...fields, day: d.day ?? null, month: d.month, payMonth: d.month });
    return Response.json({ entries: [entryDto(entry)] }, { status: 201 });
  });
}

// PATCH /api/budget/entries
// { id, title?, amount?, category?, kind?, note?, day?, projected?, done?,
//   payMonth?, payDay?, applyToSeries?, repeat? }
// `payMonth` and `payDay` are when it is paid: any date from its own month up
// to BUDGET_LIMITS.maxDelay months later (its own date clears them).
// Receiving projected income makes it real income: `amount` with
// `done: true` is what actually came in, and the estimate is kept in
// `projectedAmount`. Un-ticking it again makes it projected at its
// estimate, so it leaves the income and the left over.
// `applyToSeries` also changes the repeating entry and its later
// occurrences that are not done yet. `repeat` sets the rule from this entry
// on (null stops it repeating): see applyRepeat().
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      id: objectId,
      title: title.optional(),
      amount: amount.optional(),
      category: categoryKey.optional(),
      kind: entryKind.optional(),
      note: note.optional(),
      day: day.optional(),
      projected: z.boolean().optional(),
      done: z.boolean().optional(),
      payMonth: monthKey.optional(),
      payDay: day.optional(),
      applyToSeries: z.boolean().optional(),
      repeat: repeatRule.nullable().optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("PATCH budget entry", async () => {
    await connectToDB();
    await migrateBudget();
    const d = body.data;
    const entry = await BudgetEntry.findOne({ _id: d.id, user: auth.userId, skipped: { $ne: true } });
    if (!entry) throw apiError(404, "Entry not found");
    if (d.category !== undefined && d.category !== entry.category) {
      await assertCategory(auth.userId, entry.type, d.category);
    }

    const estimate = entry.amount;
    const wasProjected = entry.projected;
    const template = {};
    for (const key of ["title", "amount", "category", "note"]) {
      if (d[key] !== undefined) template[key] = d[key];
    }
    if (d.kind !== undefined && kindFor(entry.type, d.kind) === d.kind) template.kind = d.kind;
    if (d.projected !== undefined) template.projected = entry.type === "income" && d.projected;
    Object.assign(entry, template);
    // The day of a repeating entry comes from its rule.
    if (d.day !== undefined && (!entry.series || d.repeat === null)) {
      if (d.day && d.day > daysInMonth(entry.month)) throw apiError(400, "That month has no such day.");
      entry.day = d.day;
    }

    if (d.payMonth !== undefined || d.payDay !== undefined) {
      const payMonth = d.payMonth ?? entry.payMonth;
      // A new month without a day says nothing about the day.
      let payDay = d.payDay !== undefined ? d.payDay : d.payMonth !== undefined ? null : entry.payDay ?? null;
      // Its own date again is no pay date at all.
      if (payMonth === entry.month && payDay === (entry.day ?? null)) payDay = null;
      if (payMonth !== entry.payMonth || payDay !== (entry.payDay ?? null)) {
        if (entry.done) throw apiError(400, "This one is already done, so its date cannot change.");
        const delay = monthsBetween(entry.month, payMonth);
        if (delay < 0) throw apiError(400, "An entry cannot be paid before its own month.");
        if (delay > BUDGET_LIMITS.maxDelay) {
          throw apiError(400, `An entry can be moved up to ${BUDGET_LIMITS.maxDelay} months later.`);
        }
        if (payDay && payDay > daysInMonth(payMonth)) throw apiError(400, "That month has no such day.");
        entry.payMonth = payMonth;
        entry.payDay = payDay;
      }
    }
    if (d.done !== undefined && d.done !== entry.done) {
      entry.done = d.done;
      entry.doneAt = d.done ? new Date() : null;
      if (d.done && wasProjected) {
        // It came in, so it is no longer only projected; `amount` (if sent)
        // is what actually arrived.
        entry.projected = false;
        entry.projectedAmount = estimate;
      } else if (!d.done && entry.projectedAmount != null) {
        // It did not come in after all: back to the estimate, out of the totals.
        entry.projected = true;
        entry.amount = entry.projectedAmount;
        entry.projectedAmount = null;
      }
    }
    // Made projected by hand: projected income is never received.
    if (template.projected && entry.done) {
      entry.done = false;
      entry.doneAt = null;
      entry.projectedAmount = null;
    }

    if (d.applyToSeries && entry.series && Object.keys(template).length) {
      await BudgetSeries.updateOne({ _id: entry.series, user: auth.userId }, { $set: template });
      await BudgetEntry.updateMany(
        { user: auth.userId, series: entry.series, occ: { $gt: entry.occ }, done: false, skipped: { $ne: true } },
        { $set: template },
      );
    }
    if (d.repeat !== undefined) await applyRepeat(auth.userId, entry, d.repeat);
    await entry.save();
    return Response.json({ entry: entryDto(entry) });
  });
}

// DELETE /api/budget/entries  { id, scope?: "one" | "future" }
// One occurrence of a repeating entry is only marked skipped, so it is not
// made again; "future" ends the repeating entry before this one and removes
// this one and the later ones that are not done.
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({ id: objectId, scope: z.enum(["one", "future"]).optional() }),
  );
  if (!body.ok) return body.response;

  return run("DELETE budget entry", async () => {
    await connectToDB();
    await migrateBudget();
    const entry = await BudgetEntry.findOne({ _id: body.data.id, user: auth.userId });
    if (!entry) throw apiError(404, "Entry not found");

    if (!entry.series) {
      await entry.deleteOne();
      return Response.json({ deletedIds: [String(entry._id)] });
    }
    if (body.data.scope !== "future") {
      entry.skipped = true;
      await entry.save();
      return Response.json({ deletedIds: [String(entry._id)] });
    }

    const series = await BudgetSeries.findOne({ _id: entry.series, user: auth.userId });
    if (series) await endSeriesBefore(series, entry.occ || occOfEntry(entry));
    await BudgetEntry.deleteOne({ _id: entry._id });
    return Response.json({ deletedIds: [String(entry._id)] });
  });
}
