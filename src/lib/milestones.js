// Shared milestone rules (browser and server). Progress is always derived
// from the tasks assigned to a milestone, never stored.

export const MILESTONE_STATUSES = [
  { key: "planned", label: "Planned", tone: "muted" },
  { key: "active", label: "In progress", tone: "primary" },
  { key: "on_hold", label: "On hold", tone: "warning" },
  { key: "completed", label: "Completed", tone: "success" },
];

export const MILESTONE_STATUS_KEYS = MILESTONE_STATUSES.map((s) => s.key);

export function milestoneStatusMeta(status) {
  return (
    MILESTONE_STATUSES.find((s) => s.key === status) || MILESTONE_STATUSES[0]
  );
}

/** Tailwind classes for a status pill, per tone. */
export const STATUS_PILL_CLASS = {
  muted: "bg-surface-2 text-fg-muted border-edge",
  primary: "bg-primary-soft text-primary border-primary/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  success: "bg-success-soft text-success border-success/20",
};

export const idOf = (v) =>
  v == null ? null : typeof v === "object" ? String(v._id || v) : String(v);

export function compareMilestones(a, b) {
  const ao = Number.isFinite(a?.order) ? a.order : 0;
  const bo = Number.isFinite(b?.order) ? b.order : 0;
  if (ao !== bo) return ao - bo;
  const ad = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bd = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return ad - bd;
}

/**
 * Progress of one milestone from its tasks (subtasks count too).
 * A completed milestone always reads 100 %.
 * @returns {{ total: number, done: number, percent: number }}
 */
export function milestoneProgress(milestone, tasks = []) {
  const mid = idOf(milestone?._id ?? milestone);
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    if (idOf(t.milestone) !== mid) continue;
    total += 1;
    if (t.completed) done += 1;
  }
  if (milestone?.status === "completed") {
    return { total, done: total, percent: 100 };
  }
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { total, done, percent };
}

/** Overall project progress: average of milestone progress, or task ratio. */
export function projectProgress(milestones = [], tasks = []) {
  const active = tasks.filter((t) => !t.parentTask);
  if (!milestones.length) {
    const total = active.length;
    const done = active.filter((t) => t.completed).length;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  }
  const completed = milestones.filter((m) => m.status === "completed").length;
  const sum = milestones.reduce(
    (acc, m) => acc + milestoneProgress(m, tasks).percent,
    0,
  );
  return {
    total: milestones.length,
    done: completed,
    percent: Math.round(sum / milestones.length),
  };
}

/** Days until a date (negative when overdue), or null. */
export function daysUntil(date, now = new Date()) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target - start) / 86400000);
}

export function formatShortDate(value, { withYear = false } = {}) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/** "Oct 1 – Oct 15", "From Oct 1", "Until Oct 15" or "" when undated. */
export function formatDateRange(startDate, endDate) {
  const start = formatShortDate(startDate);
  const end = formatShortDate(endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "";
}

/**
 * Local-midnight span of an item with startDate/endDate. When only one is
 * set the span is that single day. Returns null when the item is undated.
 * @returns {{ start: Date, end: Date } | null}
 */
export function spanOf(item) {
  const parse = (v) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const start = parse(item?.startDate);
  const end = parse(item?.endDate);
  if (!start && !end) return null;
  const s = start || end;
  const e = end || start;
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

/** True when both dates are set and the end comes before the start. */
export function isInvalidRange(startDate, endDate) {
  if (!startDate || !endDate) return false;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  return e < s;
}

export function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Group a project's tasks by milestone id ("" for unassigned). */
export function groupTasksByMilestone(tasks = []) {
  const map = new Map();
  for (const t of tasks) {
    const key = idOf(t.milestone) || "";
    const list = map.get(key) || [];
    list.push(t);
    map.set(key, list);
  }
  return map;
}
