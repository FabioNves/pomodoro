// Personal Budget rules, shared by the routes and the browser. Pure functions:
// nothing about totals is stored.
//
// An entry belongs to `month` (when it happened) and counts in `payMonth`
// (when it is paid or received). They are the same until the entry is
// delayed: then it still shows in its own month, marked as delayed and left
// out of the totals, and it counts in the month it was moved to. Projected
// income counts apart from the real income until it is received. Expenses
// are bills or debt, money put aside investments or savings (kindOf); each
// pair counts as one type. An entry's date is its `day` in `month`; its pay
// date is `payDay` in `payMonth` (payDateOf), the date the cash flow uses.

import { kindOf } from "./categories.js";

/* ── months ("YYYY-MM") ────────────────────────────────── */

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(value) {
  return typeof value === "string" && MONTH_RE.test(value);
}

export function monthKeyOf(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Months from `a` to `b` (a <= b gives a positive number). */
export function monthsBetween(a, b) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function monthsOfYear(year) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

export function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthLabel(month, { short = false, withYear = true } = {}) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: short ? "short" : "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/* ── totals ────────────────────────────────────────────── */

const round = (n) => Math.round(n * 100) / 100;

export function isDelayed(entry) {
  return entry.payMonth !== entry.month;
}

/** Entries that count in `month`: the ones paid or received in it. */
export function countedIn(entries, month) {
  return entries.filter((e) => e.payMonth === month);
}

/** Entries of `month` that were pushed to a later month. */
export function delayedOutOf(entries, month) {
  return entries.filter((e) => e.month === month && e.payMonth !== month);
}

/**
 * Totals of a set of counted entries.
 * leftOver = income − expenses − invested; projected income is kept apart,
 * so "if the projected income comes in" is leftOver + projected.
 */
export function totalsOf(entries) {
  const t = {
    income: 0,
    projected: 0,
    expenses: 0,
    bills: 0,
    debt: 0,
    invested: 0,
    investments: 0,
    savings: 0,
    received: 0,
    toReceive: 0,
    paid: 0,
    toPay: 0,
    count: entries.length,
  };
  for (const e of entries) {
    const amount = Number(e.amount) || 0;
    if (e.type === "income") {
      if (e.projected) {
        t.projected += amount;
      } else {
        t.income += amount;
        if (e.done) t.received += amount;
        else t.toReceive += amount;
      }
    } else if (e.type === "expense") {
      t.expenses += amount;
      t[kindOf(e) === "debt" ? "debt" : "bills"] += amount;
      if (e.done) t.paid += amount;
      else t.toPay += amount;
    } else if (e.type === "investment") {
      t.invested += amount;
      t[kindOf(e) === "saving" ? "savings" : "investments"] += amount;
    }
  }
  for (const key of Object.keys(t)) if (key !== "count") t[key] = round(t[key]);
  t.leftOver = round(t.income - t.expenses - t.invested);
  t.leftOverWithProjected = round(t.leftOver + t.projected);
  // Share of the income not spent (invested or left over).
  t.savingsRate = t.income > 0 ? (t.income - t.expenses) / t.income : null;
  return t;
}

/** Sums by category of one entry type, largest first. */
export function byCategory(entries, type) {
  const sums = new Map();
  for (const e of entries) {
    if (e.type !== type || (type === "income" && e.projected)) continue;
    sums.set(e.category, (sums.get(e.category) || 0) + (Number(e.amount) || 0));
  }
  return [...sums.entries()]
    .map(([category, amount]) => ({ category, amount: round(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

/** Everything the month view draws. `entries` are the month's and the ones delayed into it. */
export function monthSummary(entries, month) {
  const counted = countedIn(entries, month);
  const delayed = delayedOutOf(entries, month);
  return {
    month,
    counted,
    delayed,
    totals: totalsOf(counted),
    delayedTotal: round(delayed.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)),
  };
}

/** One row per month of the year, plus the year's totals and its expense categories by month. */
export function yearSummary(entries, year) {
  // `running` is the left over added up from January: the year's cash flow.
  let running = 0;
  const months = monthsOfYear(year).map((month) => {
    const totals = totalsOf(countedIn(entries, month));
    running = round(running + totals.leftOver);
    return { month, ...totals, running };
  });
  const inYear = entries.filter((e) => e.payMonth.startsWith(`${year}-`));
  const totals = totalsOf(inYear);
  const withData = months.filter((m) => m.count > 0);
  const categoryRows = byCategory(inYear, "expense").map(({ category, amount }) => ({
    category,
    total: amount,
    months: months.map(
      ({ month }) =>
        round(
          entries
            .filter((e) => e.payMonth === month && e.type === "expense" && e.category === category)
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
        ),
    ),
  }));
  return {
    year,
    months,
    totals,
    averageExpenses: withData.length ? round(totals.expenses / withData.length) : 0,
    best: withData.length ? withData.reduce((a, b) => (b.leftOver > a.leftOver ? b : a)) : null,
    worst: withData.length ? withData.reduce((a, b) => (b.leftOver < a.leftOver ? b : a)) : null,
    categoryRows,
  };
}

/* ── dates ─────────────────────────────────────────────── */

/**
 * The day an entry is paid, in its payMonth: the pay day chosen, or its own
 * day while it is paid in its own month; null when nothing says.
 */
export function payDayOf(entry) {
  if (entry.payDay) return entry.payDay;
  return entry.payMonth === entry.month ? entry.day ?? null : null;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Nov", or "Nov" without a day: always three letters, as the rest of the UI is English. */
export function shortDate(month, day = null) {
  const label = MONTH_ABBR[Number(month.slice(5, 7)) - 1];
  return day ? `${day} ${label}` : label;
}

/** The ISO date ("2026-11-12") of a month and day, for date inputs. */
export function isoDate(month, day) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

/**
 * The cash flow of a month, day by day: what comes in and goes out on each
 * day it is paid, and the running balance from 0 at the start of the month.
 * Undated entries count on the 1st. `balanceWithProjected` adds projected
 * income on its day.
 */
export function cashFlow(entries, month) {
  const last = daysInMonth(month);
  const days = Array.from({ length: last }, (_, i) => ({ day: i + 1, in: 0, out: 0, projected: 0 }));
  for (const e of countedIn(entries, month)) {
    const d = days[Math.min(last, payDayOf(e) || 1) - 1];
    const amount = Number(e.amount) || 0;
    if (e.type === "income") {
      if (e.projected) d.projected += amount;
      else d.in += amount;
    } else {
      d.out += amount;
    }
  }
  let balance = 0;
  let withProjected = 0;
  let lowest = null;
  for (const d of days) {
    balance += d.in - d.out;
    withProjected += d.in + d.projected - d.out;
    d.in = round(d.in);
    d.out = round(d.out);
    d.projected = round(d.projected);
    d.balance = round(balance);
    d.balanceWithProjected = round(withProjected);
    if (!lowest || d.balance < lowest.balance) lowest = d;
  }
  return {
    days,
    totalIn: round(days.reduce((s, d) => s + d.in, 0)),
    totalOut: round(days.reduce((s, d) => s + d.out, 0)),
    end: round(balance),
    lowest,
    hasProjected: days.some((d) => d.projected > 0),
  };
}

/** The order entries are listed in: by pay day (undated last), then title. */
export function compareEntries(a, b) {
  const da = payDayOf(a) ?? 99;
  const db = payDayOf(b) ?? 99;
  if (da !== db) return da - db;
  return String(a.title).localeCompare(String(b.title));
}
