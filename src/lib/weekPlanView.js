// Display helpers for a week plan day: real week tasks plus the virtual rows
// the calendar shows (auto-scheduled routine tasks and dated todos). Mirrors
// the merging done in WeeklyRoutine for the planner.

import {
  dateInWeek,
  routineFrequencies,
  routineOccursOn,
  virtualRoutineTask,
} from "@/lib/routineSchedule";

export { routineFrequencies };

export const idOf = (v) =>
  v == null ? null : typeof v === "object" ? String(v._id || v) : String(v);

/* ── cycle occurrences ─────────────────────────────────── */

/** Key of one occurrence of a cycle: which routine task, on which day. */
export const occurrenceKey = (routineTaskId, dayIdx) => `${routineTaskId}:${dayIdx}`;

/**
 * The day of the cycle occurrence a week task stands for: where it was moved
 * from (`originDay`) or, if it never moved, the day it sits on.
 */
export function originDayOf(task, dayIdx) {
  return Number.isInteger(task?.originDay) ? task.originDay : dayIdx;
}

/**
 * `originDay` for a task being moved from `fromDay` to `toDay`. Only a cycle
 * task carries one, it keeps the first day it was moved from across later
 * moves, and moving it back home clears it.
 */
export function originDayAfterMove(task, fromDay, toDay) {
  if (!task?.routineTask) return null;
  const origin = originDayOf(task, fromDay);
  return origin === toDay ? null : origin;
}

/**
 * Every cycle occurrence a plan already has a real task for, as a Set of
 * occurrenceKey(). A task moved to another day still answers for the day it
 * came from, so that day does not grow a fresh auto-scheduled copy, and it
 * does not use up the occurrence of the day it was moved to either. This is
 * the one rule every view asks (planner calendar and schedule, dashboard).
 *
 * `occursOn(routineTaskId, dayIdx)` says whether the cycle runs on a day. An
 * origin only counts on such a day: a task added by hand on an off day and
 * then moved onto a real one (or a cycle whose days changed since) answers
 * for the day it sits on, as it did before it had an origin.
 */
export function occurrencesHandled(days = [], occursOn = null) {
  const handled = new Set();
  for (const day of days || []) {
    for (const task of day?.tasks || []) {
      const rt = idOf(task.routineTask);
      if (!rt) continue;
      const origin = originDayOf(task, day.dayOfWeek);
      const counted =
        origin !== day.dayOfWeek && occursOn && !occursOn(rt, origin) ? day.dayOfWeek : origin;
      handled.add(occurrenceKey(rt, counted));
    }
  }
  return handled;
}

/** occursOn() for occurrencesHandled(), from the routines and the week's dates. */
export function occursOnFor(routineTasks = [], weekStart = null) {
  const byId = new Map(routineTasks.map((rt) => [String(rt._id), rt]));
  return (rtId, dayIdx) => {
    const rt = byId.get(String(rtId));
    if (!rt) return true;
    return routineOccursOn(rt, weekStart ? dateInWeek(weekStart, dayIdx) : null, dayIdx);
  };
}

/**
 * Tasks to show for `dayIdx` (0 = Monday) of a plan, including virtuals.
 * `weekStart` ("YYYY-MM-DD") defaults to the plan's; without one, routine
 * tasks are matched on the weekday only (monthly rules and date ranges
 * need a real date).
 */
export function dayTasksForPlan({
  weekPlan,
  routineTasks = [],
  tasks = [],
  dayIdx,
  weekStart = weekPlan?.weekStart,
}) {
  const real = [
    ...(weekPlan?.days?.find((d) => d.dayOfWeek === dayIdx)?.tasks || []),
  ];
  const out = [...real];
  const date = weekStart ? dateInWeek(weekStart, dayIdx) : null;
  const handled = occurrencesHandled(weekPlan?.days, occursOnFor(routineTasks, weekStart));

  // Auto-scheduled routine tasks that fall on this day, unless a real task
  // already answers for that occurrence (even one moved to another day).
  for (const rt of routineTasks) {
    if (!rt.autoSchedule) continue;
    if (!routineOccursOn(rt, date, dayIdx)) continue;
    if (handled.has(occurrenceKey(String(rt._id), dayIdx))) continue;
    out.unshift(virtualRoutineTask(rt, dayIdx, idOf(rt.project)));
  }

  // Todos with a scheduled date on this day (display only)
  if (weekStart) {
    const start = new Date(weekStart + "T00:00:00");
    const dayStart = new Date(start);
    dayStart.setDate(start.getDate() + dayIdx);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    for (const t of tasks) {
      if (!t.scheduledDate || t.completed) continue;
      const d = new Date(t.scheduledDate);
      if (Number.isNaN(d.getTime())) continue;
      const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (local < dayStart || local >= dayEnd) continue;
      out.push({
        _id: `__dated_${t._id}`,
        _virtual: true,
        _dated: true,
        project: idOf(t.project),
        taskName: t.title,
        completed: false,
      });
    }
  }
  return out;
}

/** Colour bars per routine task id (manual colour only; no column rules here). */
export function routineColorMap(routineTasks = []) {
  const map = {};
  for (const rt of routineTasks) {
    map[String(rt._id)] = { manualColor: rt.color || "", conditionalColor: "" };
  }
  return map;
}

/** Resolve a week task's project id, falling back to its routine task's project. */
export function makeProjectResolver(routineTasks = []) {
  const rtProject = {};
  for (const rt of routineTasks) rtProject[String(rt._id)] = idOf(rt.project);
  return (task) => {
    if (task?.project) return idOf(task.project);
    const rt = idOf(task?.routineTask);
    return rt ? rtProject[rt] || null : null;
  };
}
