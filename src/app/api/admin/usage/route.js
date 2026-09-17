import { z } from "zod";
import UsageEvent from "@/models/UsageEvent";
import User from "@/models/User";
import { connectToDB } from "@/lib/db";
import { requireAdmin } from "@/lib/access/admin";
import { loadRegistry } from "@/lib/access/server";
import { jsonError, validateSearchParams } from "@/utils/apiValidation";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;

const querySchema = z.object({
  range: z.enum(["today", "7d", "30d", "custom"]).default("7d"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function utcDay(value) {
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/** [from, to) in whole UTC days. */
function bounds({ range, from, to }) {
  const today = utcDay(dayKey(new Date()));
  const tomorrow = new Date(today.getTime() + DAY_MS);
  if (range === "today") return { from: today, to: tomorrow };
  if (range === "7d") return { from: new Date(tomorrow.getTime() - 7 * DAY_MS), to: tomorrow };
  if (range === "30d") return { from: new Date(tomorrow.getTime() - 30 * DAY_MS), to: tomorrow };
  const start = from ? utcDay(from) : null;
  const endDay = to ? utcDay(to) : null;
  if (!start || !endDay || endDay < start) return null;
  const end = new Date(endDay.getTime() + DAY_MS);
  if ((end - start) / DAY_MS > MAX_DAYS) return null;
  return { from: start, to: end };
}

const dayOf = { $dateToString: { format: "%Y-%m-%d", date: "$at" } };

// GET /api/admin/usage?range=today|7d|30d|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
// Aggregates the usage events (src/lib/usage/track.js) per day, per feature
// and per external provider, plus sign-ups per day. Days are UTC.
export async function GET(req) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const query = validateSearchParams(req, querySchema);
  if (!query.ok) return query.response;
  const window = bounds(query.data);
  if (!window) return jsonError(400, "Invalid date range");

  try {
    await connectToDB();
    const match = { at: { $gte: window.from, $lt: window.to } };
    const [byDay, byFeature, external, users, signups, registry] = await Promise.all([
      UsageEvent.aggregate([
        { $match: match },
        {
          $group: {
            _id: { day: dayOf, kind: "$kind" },
            count: { $sum: "$calls" },
            cost: { $sum: "$cost" },
            users: { $addToSet: "$user" },
          },
        },
      ]),
      UsageEvent.aggregate([
        { $match: { ...match, kind: { $in: ["request", "action"] } } },
        {
          $group: {
            _id: "$feature",
            requests: { $sum: { $cond: [{ $eq: ["$kind", "request"] }, 1, 0] } },
            actions: { $sum: { $cond: [{ $eq: ["$kind", "action"] }, 1, 0] } },
            users: { $addToSet: "$user" },
          },
        },
      ]),
      UsageEvent.aggregate([
        { $match: { ...match, kind: "external" } },
        {
          $group: {
            _id: { provider: "$provider", model: "$model" },
            calls: { $sum: "$calls" },
            tokensIn: { $sum: "$tokensIn" },
            tokensOut: { $sum: "$tokensOut" },
            cost: { $sum: "$cost" },
            failed: { $sum: { $cond: ["$ok", 0, 1] } },
          },
        },
        { $sort: { cost: -1, calls: -1 } },
      ]),
      UsageEvent.distinct("user", { ...match, user: { $ne: null } }),
      User.aggregate([
        { $match: { createdAt: { $gte: window.from, $lt: window.to } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      ]),
      loadRegistry(),
    ]);

    // One row per day in the window, zeros where nothing happened.
    const days = new Map();
    for (let t = window.from.getTime(); t < window.to.getTime(); t += DAY_MS) {
      days.set(dayKey(new Date(t)), {
        date: dayKey(new Date(t)),
        requests: 0,
        actions: 0,
        externalCalls: 0,
        cost: 0,
        activeUsers: 0,
        signups: 0,
        _users: new Set(),
      });
    }
    for (const row of byDay) {
      const day = days.get(row._id.day);
      if (!day) continue;
      if (row._id.kind === "request") day.requests += row.count;
      else if (row._id.kind === "action") day.actions += row.count;
      else {
        day.externalCalls += row.count;
        day.cost += row.cost;
      }
      for (const u of row.users) if (u) day._users.add(u);
    }
    for (const row of signups) {
      const day = days.get(row._id);
      if (day) day.signups = row.count;
    }
    const dayRows = [...days.values()].map(({ _users, ...d }) => ({
      ...d,
      activeUsers: _users.size,
      cost: Math.round(d.cost * 10000) / 10000,
    }));

    const names = new Map(registry.features.map((f) => [f.key, f.name]));
    const features = byFeature
      .map((row) => ({
        key: row._id,
        name: names.get(row._id) || (row._id === "other" ? "Other" : row._id),
        requests: row.requests,
        actions: row.actions,
        users: row.users.filter(Boolean).length,
      }))
      .sort((a, b) => b.requests + b.actions - (a.requests + a.actions));

    const externalRows = external.map((row) => ({
      provider: row._id.provider || "unknown",
      model: row._id.model || "",
      calls: row.calls,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      cost: Math.round(row.cost * 10000) / 10000,
      failed: row.failed,
    }));

    const totals = dayRows.reduce(
      (acc, d) => ({
        requests: acc.requests + d.requests,
        actions: acc.actions + d.actions,
        externalCalls: acc.externalCalls + d.externalCalls,
        cost: acc.cost + d.cost,
        signups: acc.signups + d.signups,
      }),
      { requests: 0, actions: 0, externalCalls: 0, cost: 0, signups: 0 },
    );
    totals.cost = Math.round(totals.cost * 10000) / 10000;
    totals.activeUsers = users.length;

    return Response.json({
      range: { key: query.data.range, from: dayKey(window.from), to: dayKey(new Date(window.to.getTime() - DAY_MS)) },
      totals,
      days: dayRows,
      features,
      external: externalRows,
      currency: "USD",
    });
  } catch (error) {
    console.error("[admin] usage failed", error);
    return jsonError(500, "Could not load usage");
  }
}
