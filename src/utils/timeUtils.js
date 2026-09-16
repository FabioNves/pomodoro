import { getWeekStartsOn } from "@/lib/weekSettings";

export const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} | ${hours}:${minutes}`;
};

export const formatDatee = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

// ── Week-plan helpers ──────────────────────────────────
// Format a Date as a local YYYY-MM-DD string.
export const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Monday of the given date's week, as YYYY-MM-DD (ISO weeks; used where a
// week must stay Monday-based regardless of the user's preference).
export const getMondayOf = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toYMD(d);
};

/* ── Weeks that honour the "week starts on" setting ────────
   Planner weeks, the calendar and the dashboard use these instead of
   assuming Monday. `weekStartsOn` defaults to the stored preference. */

const firstDow = (weekStartsOn) => (weekStartsOn === "sunday" ? 0 : 1);
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** First day of `date`'s week as YYYY-MM-DD. */
export const getWeekStartOf = (date, weekStartsOn = getWeekStartsOn()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - firstDow(weekStartsOn) + 7) % 7));
  return toYMD(d);
};

/** 0..6 position of `date` inside its week (0 = the first day of the week). */
export const dayIndexOf = (date, weekStartsOn = getWeekStartsOn()) =>
  (new Date(date).getDay() - firstDow(weekStartsOn) + 7) % 7;

export const dayShortName = (date) => SHORT_DAYS[new Date(date).getDay()];
export const dayLongName = (date) => LONG_DAYS[new Date(date).getDay()];

/** The seven day names in week order ("Mon"… or "Sun"…). */
export const weekDayLabels = (weekStartsOn = getWeekStartsOn(), { long = false } = {}) => {
  const first = firstDow(weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => (long ? LONG_DAYS : SHORT_DAYS)[(first + i) % 7]);
};

/** The seven dates of the week starting `weekStart` (YYYY-MM-DD). */
export const weekDates = (weekStart) => {
  const start = new Date(`${weekStart}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

export const formatDayMonth = (d) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

/** "14/09 – 20/09" for the week starting `weekStart`. */
export const weekRangeLabel = (weekStart) => {
  const days = weekDates(weekStart);
  return `${formatDayMonth(days[0])} – ${formatDayMonth(days[6])}`;
};

/**
 * Week starts (YYYY-MM-DD) of every week whose middle day falls in `year`,
 * so a week straddling New Year is listed once, under the year it mostly
 * belongs to.
 */
export const weeksOfYear = (year, weekStartsOn = getWeekStartsOn()) => {
  const out = [];
  let start = new Date(`${getWeekStartOf(new Date(year, 0, 1), weekStartsOn)}T00:00:00`);
  for (let guard = 0; guard < 60; guard += 1) {
    const mid = new Date(start);
    mid.setDate(start.getDate() + 3);
    if (mid.getFullYear() > year) break;
    if (mid.getFullYear() === year) out.push(toYMD(start));
    start = new Date(start);
    start.setDate(start.getDate() + 7);
  }
  return out;
};

// ISO-8601 week number (weeks start Monday, week 1 contains the first Thursday).
export const getISOWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday of the current week decides the year.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  );
};

// Display label for a week plan, derived from its weekStart (YYYY-MM-DD).
// Numbered by the ISO week of the week's middle day, so a Sunday-start week
// gets the number of the Monday–Sunday week it mostly overlaps.
export const weekLabel = (weekStart) => {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + 3);
  return `Week ${getISOWeek(d)}`;
};

export const todayDate = new Date().toLocaleDateString();

export const yesterdayDate = new Date(
  new Date().setDate(new Date().getDate() - 1)
).toLocaleDateString();
