// Timezone-aware scheduling for briefings. No dependencies: Intl does the
// timezone work. Safe to import from either side, but only the server uses it.
//
// A "cycle" is one scheduled delivery, e.g. daily at 07:00 Europe/Lisbon.
// computeDueCycles() finds, for each enabled schedule, the most recent
// delivery instant that is not in the future. The scheduler generates that
// cycle if it has not been generated yet and it is not too old, which makes
// the cron idempotent and lets it run hourly, daily, or irregularly.

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MS_HOUR = 3600000;
const MS_DAY = 86400000;

const MAX_LAG_MS = {
  daily: 36 * MS_HOUR,
  custom: 36 * MS_HOUR,
  weekly: 6 * MS_DAY,
  monthly: 10 * MS_DAY,
};

/** Days in a calendar month, so a "31st" schedule still fires in February. */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatter(timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
}

export function safeTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Calendar fields of `date` in `timeZone`. */
export function localParts(date, timeZone) {
  const parts = {};
  for (const p of formatter(safeTimeZone(timeZone)).formatToParts(date)) {
    parts[p.type] = p.value;
  }
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: WEEKDAYS[parts.weekday] ?? 0,
    minutes: hour * 60 + minute,
    ymd: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/** Minutes to add to UTC to get local time in `timeZone` at `date`. */
export function tzOffsetMinutes(date, timeZone) {
  const p = localParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, date.getUTCSeconds());
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** The instant at which the wall clock in `timeZone` reads y-m-d hh:mm. */
export function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let guess = new Date(naive - tzOffsetMinutes(new Date(naive), timeZone) * 60000);
  // Second pass fixes the guess across a DST boundary.
  guess = new Date(naive - tzOffsetMinutes(guess, timeZone) * 60000);
  return guess;
}

export function parseYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

export function shiftYmd(ymd, days) {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days, 12));
  return d.toISOString().slice(0, 10);
}

function parseTime(value, fallback = "07:00") {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value || fallback) || /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(fallback);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** Weekday (0-6) of a local calendar date. */
export function weekdayOf(ymd) {
  const p = parseYmd(ymd);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 12)).getUTCDay();
}

/**
 * Most recent instant `HH:MM` on a day satisfying `dayOk` (weekday filter)
 * that is not after `now`, searching back up to `maxBackDays`.
 */
function latestCycle(now, timeZone, time, dayOk, maxBackDays) {
  const local = localParts(now, timeZone);
  const { hour, minute } = parseTime(time);
  const target = hour * 60 + minute;
  for (let back = 0; back <= maxBackDays; back += 1) {
    const ymd = back === 0 ? local.ymd : shiftYmd(local.ymd, -back);
    const weekday = back === 0 ? local.weekday : weekdayOf(ymd);
    if (!dayOk(weekday, ymd)) continue;
    if (back === 0 && local.minutes < target) continue;
    const p = parseYmd(ymd);
    return { periodKey: ymd, scheduledAt: zonedTimeToUtc({ ...p, hour, minute }, timeZone) };
  }
  return null;
}

/**
 * Cycles that are due for a preferences document.
 * @returns {{ kind: "daily"|"weekly"|"custom", periodKey: string, scheduledAt: Date, lagMs: number }[]}
 */
export function computeDueCycles(pref, now = new Date()) {
  const tz = safeTimeZone(pref.timezone || "UTC");
  const due = [];
  const consider = (kind, cycle) => {
    if (!cycle) return;
    const lagMs = now.getTime() - cycle.scheduledAt.getTime();
    if (lagMs < 0 || lagMs > MAX_LAG_MS[kind]) return;
    if (pref.lastScheduled?.[kind] === cycle.periodKey) return;
    due.push({ kind, periodKey: cycle.periodKey, scheduledAt: cycle.scheduledAt, lagMs });
  };

  if (pref.daily?.enabled) {
    consider("daily", latestCycle(now, tz, pref.daily.time || "07:00", () => true, 2));
  }
  if (pref.weekly?.enabled) {
    const day = typeof pref.weekly.day === "number" ? pref.weekly.day : 1;
    consider("weekly", latestCycle(now, tz, pref.weekly.time || "08:00", (wd) => wd === day, 8));
  }
  if (pref.monthly?.enabled) {
    const wanted = Math.min(31, Math.max(1, Number(pref.monthly.day) || 1));
    consider(
      "monthly",
      latestCycle(now, tz, pref.monthly.time || "08:00", (_wd, ymd) => isMonthDay(ymd, wanted), 40),
    );
  }
  if (pref.custom?.enabled && Array.isArray(pref.custom.days) && pref.custom.days.length) {
    const days = new Set(pref.custom.days);
    consider("custom", latestCycle(now, tz, pref.custom.time || "07:00", (wd) => days.has(wd), 8));
  }
  return due;
}

/** True when `ymd` is the requested day of its month, clamped to month length. */
function isMonthDay(ymd, wanted) {
  const p = parseYmd(ymd);
  if (!p) return false;
  return p.day === Math.min(wanted, daysInMonth(p.year, p.month));
}

/** Period key for a manual generation right now. */
export function currentPeriodKey(now, timeZone) {
  return localParts(now, timeZone).ymd;
}

function longDate(ymd) {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
  return `${DAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
}

function shortDate(ymd) {
  const p = parseYmd(ymd);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
  return `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;
}

/** "Wednesday, 10 September 2026" or "the week of 4–10 Sep 2026". */
export function periodLabel(kind, periodKey) {
  if (!parseYmd(periodKey)) return periodKey;
  if (kind === "weekly") {
    const start = shiftYmd(periodKey, -6);
    return `the week of ${shortDate(start)} – ${shortDate(periodKey)} ${parseYmd(periodKey).year}`;
  }
  if (kind === "monthly") {
    const start = shiftYmd(periodKey, -30);
    return `the month of ${shortDate(start)} – ${shortDate(periodKey)} ${parseYmd(periodKey).year}`;
  }
  return longDate(periodKey);
}

/** "Good morning" / "Good afternoon" / "Good evening" in the user's zone. */
export function greetingFor(date, timeZone) {
  const { hour } = localParts(date, safeTimeZone(timeZone));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Next delivery instant across all enabled schedules, for the settings page. */
export function nextDelivery(pref, now = new Date()) {
  const tz = safeTimeZone(pref.timezone || "UTC");
  const local = localParts(now, tz);
  const candidates = [];
  const scan = (kind, time, dayOk, maxAhead = 8) => {
    const { hour, minute } = parseTime(time);
    for (let ahead = 0; ahead <= maxAhead; ahead += 1) {
      const ymd = ahead === 0 ? local.ymd : shiftYmd(local.ymd, ahead);
      const weekday = ahead === 0 ? local.weekday : weekdayOf(ymd);
      if (!dayOk(weekday, ymd)) continue;
      const at = zonedTimeToUtc({ ...parseYmd(ymd), hour, minute }, tz);
      if (at.getTime() <= now.getTime()) continue;
      candidates.push({ kind, at });
      return;
    }
  };
  if (pref.daily?.enabled) scan("daily", pref.daily.time || "07:00", () => true);
  if (pref.weekly?.enabled) {
    const day = typeof pref.weekly.day === "number" ? pref.weekly.day : 1;
    scan("weekly", pref.weekly.time || "08:00", (wd) => wd === day);
  }
  if (pref.monthly?.enabled) {
    const wanted = Math.min(31, Math.max(1, Number(pref.monthly.day) || 1));
    scan("monthly", pref.monthly.time || "08:00", (_wd, ymd) => isMonthDay(ymd, wanted), 40);
  }
  if (pref.custom?.enabled && pref.custom.days?.length) {
    const days = new Set(pref.custom.days);
    scan("custom", pref.custom.time || "07:00", (wd) => days.has(wd));
  }
  candidates.sort((a, b) => a.at - b.at);
  return candidates[0] || null;
}
