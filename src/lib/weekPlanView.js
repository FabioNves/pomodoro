// Display helpers for a week plan day: real week tasks plus the virtual rows
// the calendar shows (auto-scheduled routine tasks and dated todos). Mirrors
// the merging done in WeeklyRoutine for the planner.

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const idOf = (v) =>
  v == null ? null : typeof v === "object" ? String(v._id || v) : String(v);

export function routineFrequencies(rt) {
  return Array.isArray(rt.frequencies) && rt.frequencies.length
    ? rt.frequencies
    : rt.frequency
      ? [rt.frequency]
      : [];
}

/** Tasks to show for `dayIdx` (0 = Monday) of a plan, including virtuals. */
export function dayTasksForPlan({ weekPlan, routineTasks = [], tasks = [], dayIdx }) {
  const real = [
    ...(weekPlan?.days?.find((d) => d.dayOfWeek === dayIdx)?.tasks || []),
  ];
  const out = [...real];

  // Auto-scheduled routine tasks that fall on this day (unless already added)
  const dayKey = DAY_KEYS[dayIdx];
  for (const rt of routineTasks) {
    if (!rt.autoSchedule) continue;
    const f = routineFrequencies(rt);
    if (!(f.includes("daily") || f.includes(dayKey))) continue;
    const already = real.some((t) => idOf(t.routineTask) === String(rt._id));
    if (already) continue;
    out.unshift({
      _id: `__auto_${rt._id}_${dayIdx}`,
      _virtual: true,
      routineTask: rt._id,
      project: idOf(rt.project),
      taskName: rt.title,
      estimatedTime: rt.estimatedTime || 0,
      completed: false,
    });
  }

  // Todos with a scheduled date on this day (display only)
  if (weekPlan?.weekStart) {
    const start = new Date(weekPlan.weekStart + "T00:00:00");
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
