"use client";

// Week list for the planner sidebar: a year dropdown and every week of that
// year (weeks start on the day chosen in Settings), past and future. Weeks
// that already have a plan show a filled dot; picking one without a plan
// creates it on the spot, so nothing has to be added by hand.

import React, { useEffect, useMemo, useRef, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import { getWeekStartOf, weekLabel, weekRangeLabel, weeksOfYear } from "@/utils/timeUtils";

function IconTrash({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3" />
    </svg>
  );
}

function IconChevronRight({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function Spinner({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * @param {object} props
 * @param {object[]} props.weekPlans   existing plans (weekStart "YYYY-MM-DD")
 * @param {string|null} props.selectedId
 * @param {(plan: object) => void} props.onSelect
 * @param {(weekStart: string) => Promise<object|null>} props.onCreate  creates and selects a plan
 * @param {(plan: object) => void} [props.onDelete]
 * @param {"monday"|"sunday"} props.weekStartsOn
 * @param {"sidebar"|"mobile"} [props.variant]
 */
export default function WeekPicker({
  weekPlans,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  weekStartsOn,
  variant = "sidebar",
}) {
  const currentYear = new Date().getFullYear();
  const todayStart = getWeekStartOf(new Date(), weekStartsOn);
  const selectedPlan = weekPlans.find((p) => p._id === selectedId) || null;
  const [year, setYear] = useState(() =>
    selectedPlan ? Number(selectedPlan.weekStart.slice(0, 4)) : currentYear,
  );
  const [creating, setCreating] = useState(null);
  const listRef = useRef(null);

  // Follow the selected plan into its year.
  const selectedStart = selectedPlan?.weekStart;
  useEffect(() => {
    if (selectedStart) setYear(Number(selectedStart.slice(0, 4)));
  }, [selectedStart]);

  const years = useMemo(() => {
    const set = new Set([currentYear - 1, currentYear, currentYear + 1, year]);
    for (const p of weekPlans) set.add(Number(p.weekStart.slice(0, 4)));
    return [...set].filter(Number.isFinite).sort((a, b) => a - b);
  }, [weekPlans, currentYear, year]);

  // A plan belongs to the row whose seven days contain its start, so plans
  // created under the other week-start setting still show up.
  const rows = useMemo(
    () =>
      weeksOfYear(year, weekStartsOn).map((start) => {
        const end = addDays(start, 6);
        const plan = weekPlans.find((p) => p.weekStart >= start && p.weekStart <= end) || null;
        return { start, end, plan, isCurrent: start === todayStart };
      }),
    [year, weekStartsOn, weekPlans, todayStart],
  );

  // Bring the selected (or current) week into view without scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const target =
      list.querySelector('[data-selected="true"]') || list.querySelector('[data-current="true"]');
    if (!target) return;
    list.scrollTop = Math.max(0, target.offsetTop - list.clientHeight / 2 + target.offsetHeight / 2);
  }, [year, selectedId]);

  const pick = async (row) => {
    if (row.plan) {
      onSelect(row.plan);
      return;
    }
    if (creating) return;
    setCreating(row.start);
    try {
      await onCreate(row.start);
    } finally {
      setCreating(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Weeks</span>
        <Dropdown
          compact
          label="Year"
          value={year}
          options={years.map((y) => ({ value: y, label: String(y) }))}
          onChange={(v) => setYear(Number(v))}
          showDot={false}
          align="end"
          triggerClassName="py-1! sm:py-1! pl-2.5! pr-2!"
        />
      </div>
      <div
        ref={listRef}
        role="listbox"
        aria-label={`Weeks of ${year}`}
        className="relative space-y-0.5 max-h-[420px] overflow-y-auto pr-0.5 [scrollbar-width:thin]"
      >
        {rows.map((row) => {
          const isActive = !!row.plan && row.plan._id === selectedId;
          const busy = creating === row.start;
          return (
            <div
              key={row.start}
              role="option"
              aria-selected={isActive}
              tabIndex={0}
              data-current={row.isCurrent ? "true" : undefined}
              data-selected={isActive ? "true" : undefined}
              onClick={() => pick(row)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick(row);
                }
              }}
              title={row.plan ? "Open this week" : "Start planning this week"}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                isActive
                  ? "bg-primary-soft text-primary font-medium"
                  : row.plan
                    ? "text-fg hover:bg-surface-hover"
                    : "text-fg-muted hover:bg-surface-hover"
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  row.plan ? "bg-primary" : "border border-edge-strong"
                }`}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate">{weekLabel(row.start)}</span>
                  {row.isCurrent ? (
                    <span className="text-[9px] uppercase tracking-wide px-1 rounded bg-accent-soft text-accent shrink-0">
                      Now
                    </span>
                  ) : null}
                </div>
                <div className="text-[10px] text-fg-subtle">{weekRangeLabel(row.start)}</div>
              </div>
              {busy ? (
                <Spinner className="w-3.5 h-3.5 text-fg-subtle" />
              ) : variant === "mobile" ? (
                <IconChevronRight className="w-4 h-4 text-fg-subtle shrink-0" />
              ) : row.plan && onDelete ? (
                <button
                  type="button"
                  className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-fg-subtle hover:text-danger p-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(row.plan);
                  }}
                  aria-label={`Delete ${weekLabel(row.start)}`}
                >
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
