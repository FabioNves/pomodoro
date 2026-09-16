"use client";

// Frequency picker for a routine task: daily or specific weekdays, plus
// monthly patterns (first Monday of the month, first week, the 15th, twice
// a month, …). Reports { frequencies, monthly } together so the "monthly"
// flag in `frequencies` always matches the rules.

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DAY_KEYS,
  DAY_LABELS,
  MAX_MONTHLY_RULES,
  MONTHLY_PRESETS,
  NTH_OPTIONS,
  addMonthlyRules,
  describeMonthlyRule,
  monthlyRules,
  ruleKey,
} from "@/lib/routineSchedule";

const selectClass =
  "px-1.5 py-1 rounded-md bg-surface-2 border border-edge text-xs text-fg outline-none focus:border-focus";

function IconChevronDown({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconX({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function RoutineFrequencyPicker({ value, monthly, onChange, summary = "" }) {
  const selected = Array.isArray(value) ? value : [];
  const rules = monthlyRules({ monthly });
  const days = selected.filter((v) => DAY_KEYS.includes(v));
  const isDaily = selected.includes("daily") || DAY_KEYS.every((d) => days.includes(d));
  // "weekly" / "custom" survive untouched; "daily", weekdays and the
  // "monthly" flag are managed here.
  const others = selected.filter((v) => !DAY_KEYS.includes(v) && v !== "daily" && v !== "monthly");

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [draft, setDraft] = useState({ type: "weekday", nth: 1, weekday: "mon", day: 15 });
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const width = 320;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPos({ top: rect.bottom + 4, left });
    }
    setOpen((v) => !v);
  };

  const emit = (freqs, nextRules) => {
    const base = freqs.filter((v) => v !== "monthly");
    onChange({
      frequencies: nextRules.length ? [...base, "monthly"] : base,
      monthly: nextRules,
    });
  };

  const toggleDay = (d) => {
    let next;
    if (isDaily) next = DAY_KEYS.filter((x) => x !== d);
    else next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    if (DAY_KEYS.every((x) => next.includes(x))) next = ["daily"];
    emit([...others, ...next], rules);
  };
  const setDaily = () => emit([...others, "daily"], rules);
  const clearAll = () => onChange({ frequencies: [], monthly: [] });
  const addRules = (added) => emit(selected, addMonthlyRules(rules, added));
  const removeRule = (rule) => emit(selected, rules.filter((r) => ruleKey(r) !== ruleKey(rule)));

  const addDraft = () => {
    if (draft.type === "day") addRules([{ type: "day", day: Number(draft.day) }]);
    else addRules([{ type: draft.type, nth: Number(draft.nth), weekday: draft.weekday }]);
  };

  const present = new Set(rules.map(ruleKey));
  const presets = MONTHLY_PRESETS.filter((p) => !p.rules.every((r) => present.has(ruleKey(r))));
  const full = rules.length >= MAX_MONTHLY_RULES;

  /* ── trigger label ─────────────────────────────────────── */

  const chips = [];
  if (isDaily) {
    chips.push(
      <span key="daily" className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-soft text-primary text-[11px] font-medium">
        Daily
      </span>,
    );
  } else {
    for (const d of DAY_KEYS) {
      if (!days.includes(d)) continue;
      chips.push(
        <span key={d} className="px-1.5 py-0.5 rounded bg-success-soft text-success text-[10px] font-medium">
          {DAY_LABELS[d].slice(0, 1)}
        </span>,
      );
    }
  }
  for (const rule of rules) {
    chips.push(
      <span key={ruleKey(rule)} className="px-1.5 py-0.5 rounded bg-accent-soft text-accent text-[10px] font-medium whitespace-nowrap">
        {describeMonthlyRule(rule, { short: true })}
      </span>,
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={summary || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-surface-2 border border-edge hover:bg-surface-hover transition-all min-h-[32px] max-w-[260px]"
        onClick={handleOpen}
      >
        {chips.length ? (
          <span className="flex flex-wrap gap-1">{chips}</span>
        ) : (
          <span className="text-xs text-fg-subtle">— pick days —</span>
        )}
        <IconChevronDown className={`w-3 h-3 shrink-0 transition-transform text-fg-subtle ${open ? "rotate-180" : ""}`} />
      </button>
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  ref={ref}
                  role="dialog"
                  aria-label="Frequency"
                  style={{ position: "fixed", top: pos.top, left: pos.left }}
                  className="w-80 max-h-[80vh] overflow-y-auto bg-surface border border-edge rounded-xl shadow-xl z-[9999] [scrollbar-width:thin]"
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.12 }}
                >
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">Every week</div>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                        isDaily ? "bg-primary-soft text-primary font-medium" : "text-fg hover:bg-surface-hover"
                      }`}
                      onClick={setDaily}
                    >
                      <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs bg-primary-soft text-primary">🔄</span>
                      <span>Daily</span>
                    </button>
                    <div className="px-2 pb-1 grid grid-cols-2">
                      {DAY_KEYS.map((d) => {
                        const checked = isDaily || days.includes(d);
                        return (
                          <label key={d} className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-hover text-sm text-fg">
                            <input type="checkbox" checked={checked} onChange={() => toggleDay(d)} className="w-4 h-4" />
                            <span>{DAY_LABELS[d].slice(0, 3)}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="border-t border-edge my-1" />
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">Every month</div>
                    {rules.length ? (
                      <ul className="px-2 pb-1 space-y-0.5">
                        {rules.map((rule) => (
                          <li key={ruleKey(rule)} className="flex items-center gap-2 px-2 py-1 rounded-md text-sm text-fg bg-accent-soft/60">
                            <span className="flex-1 min-w-0 truncate">{describeMonthlyRule(rule)}</span>
                            <button
                              type="button"
                              onClick={() => removeRule(rule)}
                              aria-label={`Remove ${describeMonthlyRule(rule)}`}
                              className="p-0.5 rounded text-fg-subtle hover:text-danger"
                            >
                              <IconX className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 pb-1 text-xs text-fg-subtle">No monthly pattern yet.</p>
                    )}
                    {presets.length && !full ? (
                      <div className="px-3 pb-2 flex flex-wrap gap-1">
                        {presets.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => addRules(p.rules)}
                            className="px-2 py-0.5 rounded-full border border-edge bg-surface-2 text-[11px] text-fg-muted hover:text-fg hover:border-edge-strong transition-colors"
                          >
                            + {p.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="px-3 pb-2">
                      <p className="text-[10px] text-fg-subtle mb-1">Custom pattern</p>
                      <div className="flex flex-wrap items-center gap-1">
                        <select
                          className={selectClass}
                          value={draft.type}
                          onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                          aria-label="Pattern type"
                        >
                          <option value="weekday">Weekday of the month</option>
                          <option value="week">Week of the month</option>
                          <option value="day">Day of the month</option>
                        </select>
                        {draft.type !== "day" ? (
                          <select
                            className={selectClass}
                            value={draft.nth}
                            onChange={(e) => setDraft((d) => ({ ...d, nth: Number(e.target.value) }))}
                            aria-label="Which one"
                          >
                            {NTH_OPTIONS.map((n) => (
                              <option key={n.value} value={n.value}>
                                {n.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {draft.type !== "day" ? (
                          <select
                            className={selectClass}
                            value={draft.weekday}
                            onChange={(e) => setDraft((d) => ({ ...d, weekday: e.target.value }))}
                            aria-label="Weekday"
                          >
                            {DAY_KEYS.map((d) => (
                              <option key={d} value={d}>
                                {DAY_LABELS[d]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            className={selectClass}
                            value={draft.day}
                            onChange={(e) => setDraft((d) => ({ ...d, day: Number(e.target.value) }))}
                            aria-label="Day of the month"
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                            <option value={-1}>Last day</option>
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={addDraft}
                          disabled={full}
                          className="px-2.5 py-1 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                      {draft.type === "week" ? (
                        <p className="mt-1 text-[10px] text-fg-subtle">Scheduled on that weekday of the chosen week (days 1–7 are the first week).</p>
                      ) : null}
                      {full ? <p className="mt-1 text-[10px] text-warning">At most {MAX_MONTHLY_RULES} patterns per task.</p> : null}
                    </div>

                    <div className="border-t border-edge" />
                    <button type="button" className="w-full text-left px-3 py-2 text-xs text-fg-subtle hover:bg-surface-hover" onClick={clearAll}>
                      Clear
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
