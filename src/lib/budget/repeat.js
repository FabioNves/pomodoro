// How a repeating budget entry repeats, shared by the server (which makes
// the entries) and the browser (which edits and describes the rule).
//
// A rule is { interval, days, startDate, endDate }: every `interval` months,
// counted from the month of `startDate`, on each of `days` (days of the
// month; none means once that month with no set day). A day past the end of
// a short month falls on its last day. `startDate` and `endDate` are ISO
// dates ("2026-11-15"); occurrences before the start or after the end are
// not made. Each occurrence has a key, `occ`: its ISO date, or its month
// ("2026-11") when it has no day.

import { daysInMonth, monthsBetween } from "./engine.js";

export const REPEAT_LIMITS = { interval: 24, days: 6 };
export const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// The usual rules, one click each in the editor; anything else is custom.
export const REPEAT_PRESETS = [
  { key: "monthly", label: "Monthly", interval: 1, times: 1 },
  { key: "twice", label: "Twice a month", interval: 1, times: 2 },
  { key: "quarterly", label: "Every 3 months", interval: 3, times: 1 },
  { key: "half", label: "Every 6 months", interval: 6, times: 1 },
  { key: "yearly", label: "Yearly", interval: 12, times: 1 },
];

export const INTERVAL_OPTIONS = [1, 2, 3, 4, 6, 12].map((n) => ({
  value: n,
  label: n === 1 ? "Every month" : n === 12 ? "Every year" : `Every ${n} months`,
}));

/** Days sorted, without repeats, kept to the limit. */
export function normalizeDays(days) {
  return [...new Set((days || []).map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 31))]
    .sort((a, b) => a - b)
    .slice(0, REPEAT_LIMITS.days);
}

export const isoOf = (month, day) => `${month}-${String(day).padStart(2, "0")}`;

/** The date an occurrence counts from: its day, or the 1st when it has none. */
export function occDate(occ) {
  return occ.length === 7 ? `${occ}-01` : occ;
}

/** The ISO date one day earlier. */
export function dayBefore(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - 1));
  return date.toISOString().slice(0, 10);
}

/** Does the rule fall in `month` at all (start, end and interval)? */
export function ruleRunsIn(rule, month) {
  const start = rule.startDate.slice(0, 7);
  if (month < start) return false;
  if (rule.endDate && month > rule.endDate.slice(0, 7)) return false;
  return monthsBetween(start, month) % (rule.interval || 1) === 0;
}

/** The rule's occurrences in `month`: [{ occ, day }], within its start and end. */
export function occurrencesIn(rule, month) {
  if (!ruleRunsIn(rule, month)) return [];
  const last = daysInMonth(month);
  const days = normalizeDays(rule.days);
  const list = days.length
    ? [...new Set(days.map((d) => Math.min(d, last)))].map((day) => ({ occ: isoOf(month, day), day }))
    : [{ occ: month, day: null }];
  return list.filter(({ occ }) => {
    const date = occDate(occ);
    return date >= rule.startDate && (!rule.endDate || date <= rule.endDate);
  });
}

const ordinal = (n) => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
};

function listOf(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateLabel = (iso) => `${Number(iso.slice(8))} ${MONTH_ABBR[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** "Every month on the 1st and 15th, until 31 Dec 2027". */
export function describeRepeat(rule) {
  if (!rule) return "";
  const interval = rule.interval || 1;
  const days = normalizeDays(rule.days);
  const every = interval === 1 ? "Every month" : interval === 12 ? "Every year" : `Every ${interval} months`;
  const when = days.length ? ` on the ${listOf(days.map(ordinal))}` : "";
  const end = rule.endDate ? `, until ${dateLabel(rule.endDate)}` : "";
  return `${every}${when}${end}`;
}

/** The preset a rule matches, or null for a custom one. */
export function presetOf(rule) {
  const days = normalizeDays(rule.days);
  return REPEAT_PRESETS.find((p) => p.interval === (rule.interval || 1) && p.times === Math.max(1, days.length))?.key || null;
}

/** A preset applied to a rule, keeping its first day (twice a month adds one 15 days later). */
export function applyPreset(rule, key) {
  const preset = REPEAT_PRESETS.find((p) => p.key === key);
  const first = normalizeDays(rule.days)[0] || null;
  let days = first ? [first] : [];
  if (preset.times === 2) {
    const a = first || 1;
    days = normalizeDays([a, a + 15 > 31 ? a - 15 : a + 15]);
  }
  return { ...rule, interval: preset.interval, days };
}

