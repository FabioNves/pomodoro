import { connectToDB } from "@/lib/db";
import NewsPreference from "@/models/NewsPreference";
import Briefing from "@/models/Briefing";
import { computeDueCycles } from "@/lib/news/schedule";
import { userCanUse } from "@/lib/access/server";
import {
  startBriefing,
  runNextEdition,
  continuationChain,
  triggerContinuation,
  findResumableBriefings,
  isInternalRequest,
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
// recent delivery time in their timezone, and starts the briefings that are
// due and not yet produced. Runs are idempotent, so the cron may fire hourly
// (Pro) or once a day (Hobby) and users still get each cycle once.
//
// A briefing with several editions takes several invocations, so the cron
// only starts each run and hands its first edition to a fresh invocation
// (POST /api/news/briefings/continue); every edition then hands off the next.
// If a hand-off cannot be made, the edition runs here while time allows and
// the rest is picked up by the next cron run. Runs whose hand-off was lost
// are resumed too. Cycles that failed for a transient reason are retried;
// cycles that failed for a configuration reason are not.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const RUN_BUDGET_MS = 250000;
const MAX_ATTEMPTS = 3;

async function runScheduler(req) {
  if (!isInternalRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const now = new Date();
  const deadline = Date.now() + RUN_BUDGET_MS;
  const log = (m) => console.log(`[news cron] ${m}`);
  const chain = continuationChain(req);

  try {
    await connectToDB();
    const prefs = await NewsPreference.find({
      $or: [
        { "daily.enabled": true },
        { "weekly.enabled": true },
        { "monthly.enabled": true },
        { "custom.enabled": true },
      ],
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

    // A schedule only runs for users whose plan includes the briefing
    // (feature registry); the cycle stays due and is served once it does.
    const included = new Map();
    const planIncludes = async (userId) => {
      if (!included.has(userId)) {
        included.set(userId, await userCanUse(userId, "news_briefing").catch(() => false));
      }
      return included.get(userId);
    };

    /** Hand a run to a fresh invocation, or run an edition here if that fails. */
    const drive = async (briefingId) => {
      if (chain && (await triggerContinuation(briefingId, chain, log))) return "handed_off";
      const budgetMs = deadline - Date.now();
      if (budgetMs < MIN_GENERATION_MS) return "waiting";
      const done = await runNextEdition(briefingId, { log, budgetMs, chain: null });
      return done?.status || "waiting";
    };

    for (const cycle of due) {
      const entry = { user: cycle.user, kind: cycle.kind, periodKey: cycle.periodKey, scheduledAt: cycle.scheduledAt };
      if (!(await planIncludes(cycle.user))) {
        results.push({ ...entry, status: "not_in_plan" });
        continue;
      }
      if (dryRun) {
        results.push({ ...entry, status: "due" });
        continue;
      }

      // Idempotency: a scheduled briefing for this cycle may already exist
      // (duplicate cron delivery, an earlier run, or a run still going).
      const existing = await Briefing.findOne({
        user: cycle.user,
        kind: cycle.kind,
        periodKey: cycle.periodKey,
        trigger: "scheduled",
      })
        .sort({ createdAt: -1 })
        .select({ status: 1, errorCode: 1 })
        .lean();

      if (existing?.status === "generating") {
        results.push({ ...entry, status: "in_progress", briefingId: String(existing._id) });
        continue;
      }
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

      try {
        const briefing = await startBriefing({
          userId: cycle.user,
          kind: cycle.kind,
          trigger: "scheduled",
          periodKey: cycle.periodKey,
        });
        const status = await drive(briefing._id);
        if (status === "waiting") deferred += 1;
        results.push({
          ...entry,
          status,
          briefingId: String(briefing._id),
          editions: briefing.editions.length,
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

    // Runs whose chain of hand-offs broke, manual ones included.
    const resumed = [];
    if (!dryRun) {
      const startedHere = new Set(results.map((r) => r.briefingId).filter(Boolean));
      for (const run of await findResumableBriefings({ limit: 20 })) {
        if (startedHere.has(String(run._id))) continue;
        const status = await drive(run._id);
        resumed.push({ briefingId: String(run._id), user: run.user, status });
      }
      if (resumed.length) log(`${resumed.length} stalled run(s) resumed`);
    }

    if (deferred) log(`${deferred} cycle(s) left for the next run`);
    return Response.json({
      ok: true,
      ranAt: now.toISOString(),
      dryRun,
      usersWithSchedules: prefs.length,
      due: due.length,
      deferred,
      results,
      resumed,
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
