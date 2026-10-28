// Calendar timing belongs to the original dated task, independently of its
// timeline start/end dates. Use calendar arithmetic across DST boundaries.
export function datedTaskView(task) {
  return {
    _id: `__dated_${task._id}`,
    _virtual: true,
    _dated: true,
    sourceTaskId: String(task._id),
    project: task.project && typeof task.project === "object" ? String(task.project._id) : task.project,
    taskName: task.title,
    completed: !!task.completed,
    startMinute: task.startMinute ?? null,
    durationMinutes: task.durationMinutes ?? null,
  };
}

export function datedTaskPlacement(weekStart, dayIdx, updates) {
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + dayIdx);
  const scheduledDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { scheduledDate, ...updates };
}

export const planTaskCount = (plan) =>
  (plan.days || []).reduce((total, day) => total + (day.tasks || []).length, 0);

// Older populated plans must not be shadowed by newer empty copies.
export function preferredWeekPlans(plans = []) {
  return [...plans].sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart) || planTaskCount(b) - planTaskCount(a) ||
    String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || String(a._id).localeCompare(String(b._id)),
  );
}

// A week has one visible plan. Legacy copies remain stored separately; keep
// each task's owner so edits still write to its original saved document.
export function combinedWeekPlans(plans = []) {
  const groups = new Map();
  for (const plan of preferredWeekPlans(plans)) {
    const key = `${plan.user || ""}:${plan.sessionId || ""}:${plan.weekStart}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(plan);
  }
  return [...groups.values()].map((copies) => {
    const primary = copies[0];
    const seen = new Set();
    const days = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, tasks: [] }));
    for (const copy of copies) {
      for (const day of copy.days || []) {
        for (const task of day.tasks || []) {
          if (seen.has(String(task._id))) continue;
          seen.add(String(task._id));
          days[day.dayOfWeek].tasks.push({ ...task, _sourcePlanId: copy._id });
        }
      }
    }
    return { ...primary, days, projects: [...new Set(copies.flatMap((copy) => (copy.projects || []).map(String)))], _sourcePlans: copies };
  });
}

export function weekTaskOwner(plan, taskId) {
  return plan?.days?.flatMap((day) => day.tasks || []).find((task) => String(task._id) === String(taskId))?._sourcePlanId || plan?._id;
}

export function applyWeekPlanUpdate(plans, updated) {
  if (Array.isArray(updated)) return updated;
  if (!updated?._sourcePlans) {
    return plans.some((plan) => plan._id === updated._id)
      ? plans.map((plan) => plan._id === updated._id ? updated : plan) : [updated, ...plans];
  }
  const ids = new Set(updated._sourcePlans.map((plan) => plan._id));
  return plans.map((plan) => !ids.has(plan._id) ? plan : {
    ...plan,
    days: updated.days.map((day) => ({ ...day, tasks: day.tasks.filter((task) => (task._sourcePlanId || updated._id) === plan._id) })),
  });
}
