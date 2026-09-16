// When does a routine task occur? Shared by the API (validation), the
// planner calendar/grid, the dashboard and the routine table.
//
// A routine task carries:
//   frequencies  ["daily"] | day keys ("mon".."sun") | "weekly" | "custom"
//                | "monthly" (flag: the `monthly` rules below apply)
//   monthly      [{ type: "weekday", nth, weekday }]  first Monday of the month
//                [{ type: "week", nth, weekday? }]    first week of the month
//                [{ type: "day", day }]               the 15th, or -1 = last day
//   startDate / endDate   "YYYY-MM-DD" bounds (either may be empty)
//   startMinute  minutes after midnight the task is meant to happen (null = any time)
//   estimatedTime  minutes, used as the calendar block length

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const NTH_OPTIONS = [
  { value: 1, label: "First" },
  { value: 2, label: "Second" },
  { value: 3, label: "Third" },
  { value: 4, label: "Fourth" },
  { value: -1, label: "Last" },
];

export const MONTHLY_RULE_TYPES = ["weekday", "week", "day"];
export const MAX_MONTHLY_RULES = 10;

/** Ready-made monthly patterns offered by the picker. */
export const MONTHLY_PRESETS = [
  { key: "first-mon", label: "First Monday", rules: [{ type: "weekday", nth: 1, weekday: "mon" }] },
  { key: "last-fri", label: "Last Friday", rules: [{ type: "weekday", nth: -1, weekday: "fri" }] },
  { key: "first-week", label: "First week", rules: [{ type: "week", nth: 1 }] },
  { key: "start", label: "Start of month (1st)", rules: [{ type: "day", day: 1 }] },
  { key: "middle", label: "Middle of month (15th)", rules: [{ type: "day", day: 15 }] },
  { key: "end", label: "End of month", rules: [{ type: "day", day: -1 }] },
  {
    key: "twice",
    label: "Twice a month (1st & 15th)",
    rules: [
      { type: "day", day: 1 },
      { type: "day", day: 15 },
    ],
  },
];

/* ── dates ─────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, "0");

/** Local calendar date as "YYYY-MM-DD". */
export function ymd(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" → local Date at midnight, or null. */
export function parseYmd(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Date of day `dayIdx` (0 = Monday) in the week starting `weekStart` ("YYYY-MM-DD"). */
export function dateInWeek(weekStart, dayIdx) {
  const start = parseYmd(weekStart);
  if (!start) return null;
  const d = new Date(start);
  d.setDate(start.getDate() + dayIdx);
  return d;
}

const dayKeyOf = (date) => DAY_KEYS[(date.getDay() + 6) % 7];
const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

/* ── frequencies ───────────────────────────────────────── */

export function routineFrequencies(rt) {
  if (!rt) return [];
  return Array.isArray(rt.frequencies) && rt.frequencies.length
    ? rt.frequencies
    : rt.frequency
      ? [rt.frequency]
      : [];
}

export function monthlyRules(rt) {
  return Array.isArray(rt?.monthly) ? rt.monthly.filter(isValidMonthlyRule) : [];
}

export function isValidMonthlyRule(rule) {
  if (!rule || typeof rule !== "object") return false;
  if (rule.type === "weekday") {
    return NTH_OPTIONS.some((n) => n.value === rule.nth) && DAY_KEYS.includes(rule.weekday);
  }
  if (rule.type === "week") {
    return (
      NTH_OPTIONS.some((n) => n.value === rule.nth) &&
      (rule.weekday == null || rule.weekday === "" || DAY_KEYS.includes(rule.weekday))
    );
  }
  if (rule.type === "day") {
    return Number.isInteger(rule.day) && rule.day !== 0 && rule.day >= -1 && rule.day <= 31;
  }
  return false;
}

/** Same rule twice ("first Monday" added again) is dropped. */
export function ruleKey(rule) {
  if (rule.type === "weekday") return `weekday:${rule.nth}:${rule.weekday}`;
  if (rule.type === "week") return `week:${rule.nth}:${rule.weekday || ""}`;
  return `day:${rule.day}`;
}

export function addMonthlyRules(existing, added) {
  const out = [...(existing || [])];
  const seen = new Set(out.map(ruleKey));
  for (const rule of added || []) {
    if (!isValidMonthlyRule(rule)) continue;
    const key = ruleKey(rule);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rule);
  }
  return out.slice(0, MAX_MONTHLY_RULES);
}

/** Does one monthly rule fall on `date`? */
export function monthlyRuleMatches(rule, date) {
  if (!isValidMonthlyRule(rule)) return false;
  const day = date.getDate();
  const total = daysInMonth(date);
  if (rule.type === "day") {
    const wanted = rule.day === -1 ? total : Math.min(rule.day, total);
    return day === wanted;
  }
  if (rule.type === "weekday") {
    if (dayKeyOf(date) !== rule.weekday) return false;
    if (rule.nth === -1) return day + 7 > total;
    return Math.ceil(day / 7) === rule.nth;
  }
  // "week": days 1-7 are the first week, 8-14 the second …; the last week is
  // the final seven days. The task lands on the chosen weekday (Monday by
  // default) inside that week.
  const weekday = rule.weekday || "mon";
  if (dayKeyOf(date) !== weekday) return false;
  if (rule.nth === -1) return day + 7 > total;
  return Math.ceil(day / 7) === rule.nth;
}

/**
 * Does the routine task occur on `date`? Without a date (no week start
 * known) only the weekday pattern is considered.
 */
export function routineOccursOn(rt, date, dayIdx = null) {
  const freqs = routineFrequencies(rt);
  const rules = monthlyRules(rt);
  const key = date ? dayKeyOf(date) : dayIdx != null ? DAY_KEYS[dayIdx] : null;

  if (date) {
    const today = ymd(date);
    if (rt.startDate && YMD_RE.test(rt.startDate) && today < rt.startDate) return false;
    if (rt.endDate && YMD_RE.test(rt.endDate) && today > rt.endDate) return false;
  }
  if (freqs.includes("daily")) return true;
  if (key && freqs.includes(key)) return true;
  if (date && rules.length) return rules.some((rule) => monthlyRuleMatches(rule, date));
  return false;
}

/** The virtual week-task row the calendar shows for an auto-scheduled routine. */
export function virtualRoutineTask(rt, dayIdx, projectId) {
  return {
    _id: `__auto_${rt._id}_${dayIdx}`,
    _virtual: true,
    routineTask: rt._id,
    project: projectId ?? null,
    taskName: rt.title,
    estimatedTime: rt.estimatedTime || 0,
    startMinute: Number.isInteger(rt.startMinute) ? rt.startMinute : null,
    completed: false,
  };
}

/* ── labels ────────────────────────────────────────────── */

const ordinal = (nth) => NTH_OPTIONS.find((n) => n.value === nth)?.label.toLowerCase() || "";
const dayOrdinal = (d) => {
  if (d === -1) return "last day";
  const s = ["th", "st", "nd", "rd"];
  const v = d % 100;
  return `${d}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export function describeMonthlyRule(rule, { short = false } = {}) {
  if (!isValidMonthlyRule(rule)) return "";
  if (rule.type === "weekday") {
    const day = short ? DAY_LABELS[rule.weekday].slice(0, 3) : DAY_LABELS[rule.weekday];
    return short ? `${ordinal(rule.nth)} ${day}` : `${ordinal(rule.nth)} ${day} of the month`;
  }
  if (rule.type === "week") {
    const day = rule.weekday ? ` (${DAY_LABELS[rule.weekday].slice(0, 3)})` : "";
    return short ? `${ordinal(rule.nth)} week${day}` : `${ordinal(rule.nth)} week of the month${day}`;
  }
  return short ? dayOrdinal(rule.day) : `${dayOrdinal(rule.day)} of the month`;
}

export function minutesToClock(m) {
  if (!Number.isInteger(m)) return "";
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** "09:30" → 570; empty or invalid → null (no fixed time). */
export function clockToMinutes(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** One-line summary: "Mon, Wed · first Monday of the month · at 09:00 · until 2026-12-31". */
export function describeRoutineSchedule(rt) {
  const parts = [];
  const freqs = routineFrequencies(rt);
  if (freqs.includes("daily")) parts.push("Daily");
  else {
    const days = DAY_KEYS.filter((k) => freqs.includes(k)).map((k) => DAY_LABELS[k].slice(0, 3));
    if (days.length) parts.push(days.join(", "));
    if (freqs.includes("weekly")) parts.push("Weekly");
    if (freqs.includes("custom") && rt.frequencyCustom) parts.push(rt.frequencyCustom);
  }
  for (const rule of monthlyRules(rt)) parts.push(describeMonthlyRule(rule));
  if (Number.isInteger(rt.startMinute)) parts.push(`at ${minutesToClock(rt.startMinute)}`);
  if (rt.startDate && rt.endDate) parts.push(`${rt.startDate} to ${rt.endDate}`);
  else if (rt.startDate) parts.push(`from ${rt.startDate}`);
  else if (rt.endDate) parts.push(`until ${rt.endDate}`);
  return parts.join(" · ");
}
