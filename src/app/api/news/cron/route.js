import { timingSafeEqual } from "node:crypto";
import { connectToDB } from "@/lib/db";
import NewsPreference from "@/models/NewsPreference";
import Briefing from "@/models/Briefing";
import { computeDueCycles } from "@/lib/news/schedule";
import {
  generateNow,
  markCycleDelivered,
  isTransientFailure,
  GenerationError,
  MIN_GENERATION_MS,
} from "@/lib/news/generate";

// Scheduled briefings.
//
// Vercel Cron calls GET /api/news/cron (see vercel.json) with
// "Authorization: Bearer $CRON_SECRET"; any other scheduler can do the same.
// Each run looks at every user with a schedule enabled, works out the most
// recent delivery time in their timezone, and generates the briefings that
// are due and not yet produced. Runs are idempotent, so the cron may fire
// hourly (Pro) or once a day (Hobby) and users still get each cycle once.
//
// A run never starts work it cannot finish: each generation is given the time
// the invocation has left, and anything that does not fit is left for the
// next run. Cycles that failed for a transient reason are retried; cycles
// that failed for a configuration reason are not.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const RUN_BUDGET_MS = 250000;
const MAX_ATTEMPTS = 3;

function authorized(req) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  // Compare in constant time; differing lengths are rejected outright, which
  // timingSafeEqual would otherwise throw on.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function runScheduler(req) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const now = new Date();
  const deadline = Date.now() + RUN_BUDGET_MS;
  const log = (m) => console.log(`[news cron] ${m}`);

  try {
    await connectToDB();
    const prefs = await NewsPreference.find({
      $or: [{ "daily.enabled": true }, { "weekly.enabled": true }, { "custom.enabled": true }],
    }).lean();

    const due = [];
    for (const pref of prefs) {
      for (const cycle of computeDueCycles(pref, now)) {
        due.push({ user: pref.user, prefId: pref._id, ...cycle });
      }
    }
    // Longest-overdue first, so a run that cannot serve everyone never
    // starves the same users twice.
    due.sort((a, b) => b.lagMs - a.lagMs);
    log(`${prefs.length} users with schedules, ${due.length} cycles due`);

    const results = [];
    let deferred = 0;
    for (const cycle of due) {
      const entry = { user: cycle.user, kind: cycle.kind, periodKey: cycle.periodKey, scheduledAt: cycle.scheduledAt };
      if (dryRun) {
        results.push({ ...entry, status: "due" });
        continue;
      }

      // Idempotency: a scheduled briefing for this cycle may already exist
      // (duplicate cron delivery, or an earlier run). Only a transient
      // failure is worth another attempt.
      const existing = await Briefing.findOne({
        user: cycle.user,
        kind: cycle.kind,
        periodKey: cycle.periodKey,
        trigger: "scheduled",
      })
        .sort({ createdAt: -1 })
        .select({ status: 1, errorCode: 1 })
        .lean();

      if (existing) {
        const retryable = existing.status === "failed" && isTransientFailure(existing.errorCode);
        if (!retryable) {
          await markCycleDelivered(cycle.user, cycle.kind, cycle.periodKey);
          results.push({ ...entry, status: "already_generated" });
          continue;
        }
        const attempts = await Briefing.countDocuments({
          user: cycle.user,
          kind: cycle.kind,
          periodKey: cycle.periodKey,
          trigger: "scheduled",
          status: "failed",
        });
        if (attempts >= MAX_ATTEMPTS) {
          await markCycleDelivered(cycle.user, cycle.kind, cycle.periodKey);
          results.push({ ...entry, status: "gave_up", attempts });
          continue;
        }
      }

      // Only start what fits in the time this invocation has left.
      const budgetMs = deadline - Date.now();
      if (budgetMs < MIN_GENERATION_MS) {
        deferred += 1;
        continue;
      }

      try {
        const briefing = await generateNow({
          userId: cycle.user,
          kind: cycle.kind,
          trigger: "scheduled",
          periodKey: cycle.periodKey,
          budgetMs,
          log,
        });
        results.push({
          ...entry,
          status: briefing.status,
          briefingId: String(briefing._id),
          error: briefing.error || undefined,
        });
      } catch (error) {
        // A manual generation is in flight for this user: leave the cycle for
        // the next run rather than consuming it.
        if (error instanceof GenerationError && error.code === "already_running") {
          deferred += 1;
          results.push({ ...entry, status: "deferred_busy" });
          continue;
        }
        log(`generation for ${cycle.user} (${cycle.kind}) failed: ${error?.message}`);
        results.push({ ...entry, status: "failed", error: error?.message || String(error) });
      }
    }

    if (deferred) log(`${deferred} cycle(s) deferred to the next run`);
    return Response.json({
      ok: true,
      ranAt: now.toISOString(),
      dryRun,
      usersWithSchedules: prefs.length,
      due: due.length,
      deferred,
      results,
    });
  } catch (error) {
    console.error("[news cron] failed", error);
    return Response.json({ error: "Scheduler failed" }, { status: 500 });
  }
}

export async function GET(req) {
  return runScheduler(req);
}

export async function POST(req) {
  return runScheduler(req);
}
