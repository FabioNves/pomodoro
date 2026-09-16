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

  // Auto-scheduled routine tasks that fall on this day (unless already added)
  for (const rt of routineTasks) {
    if (!rt.autoSchedule) continue;
    if (!routineOccursOn(rt, date, dayIdx)) continue;
    const already = real.some((t) => idOf(t.routineTask) === String(rt._id));
    if (already) continue;
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
