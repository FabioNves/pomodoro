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
