"use client";

// Building blocks shared by the Personal Budget screens: the totals tile,
// the paid/received check, the series colours and a few icons. The generic
// controls come from the news and notebook screens, as Business does.

import React from "react";
import { ENTRY_CHOICES, categoriesOf, entryTypeMeta, formatMoney } from "@/lib/budget/categories";

export {
  ActionButton,
  Spinner,
  Toggle,
  Banner,
  EmptyState,
  IconPlus,
  IconCheck,
  IconClock,
  IconAlert,
  IconChevronDown,
  IconChevronUp,
  IconTag,
} from "@/components/news/newsUi";

export { PopoverMenu, Field, inputClass, Segmented, IconTrash, IconEdit } from "@/components/notebook/notebookUi";

const icon = (path) =>
  function Icon({ className = "w-4 h-4" }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    );
  };

export const IconWallet = icon("M3 7a2 2 0 012-2h13v4M3 7v10a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16 14h.01");
export const IconRepeat = icon("M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3");
export const IconDelay = icon("M12 8v4l2 2M3.5 12a8.5 8.5 0 1015-5.5M18.5 2.5v4h-4");
export const IconUndo = icon("M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3");
export const IconLeft = icon("M15 6l-6 6 6 6");
export const IconRight = icon("M9 6l6 6-6 6");

/**
 * Colours of the three flows and what is left over, the same in every chart,
 * legend, tile and panel border: income green, expenses red, investments
 * blue (the themes have no blue token, so it is Tailwind's). Left over is
 * ink, drawn as a line. Checked with the dataviz palette validator in the
 * light and dark themes.
 */
export const SERIES = {
  income: { label: "Income", color: "var(--success)" },
  expenses: { label: "Expenses", color: "var(--danger)" },
  invested: { label: "Saved & invested", color: "var(--color-blue-500, #3b82f6)" },
  leftOver: { label: "Left over", color: "var(--fg-muted)" },
};

/** The border of a tile, panel or row, by entry type. */
export const TYPE_BORDER = {
  income: "border-success/70",
  expense: "border-danger/70",
  investment: "border-blue-500/70",
};

/** Text and dot colours by entry type, for the "what is it?" choices. */
export const TYPE_TEXT = { income: "text-success", expense: "text-danger", investment: "text-blue-500" };
export const TYPE_DOT = { income: "bg-success", expense: "bg-danger", investment: "bg-blue-500" };

/** ENTRY_CHOICES as Dropdown options, each in its type's colour. */
export function choiceOptions() {
  return ENTRY_CHOICES.map((c) => ({
    value: c.key,
    label: c.label,
    colorClass: TYPE_DOT[c.type],
    textClass: TYPE_TEXT[c.type],
  }));
}

/** A category list as Dropdown options. */
export function categoryOptions(categories, type) {
  return categoriesOf(categories, type).map((c) => ({ value: c.key, label: c.label }));
}

/** Buttons for a few choices (a type, a kind), each label in its own colour. */
export function ChoiceButtons({ value, options, onChange, label }) {
  return (
    <div
      className="grid gap-1 p-1 rounded-lg bg-surface-2 border border-edge"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`px-2 py-1.5 rounded-md text-sm transition-colors truncate ${o.textClass || "text-fg"} ${
              active ? "bg-surface font-semibold shadow-sm" : "font-medium opacity-60 hover:opacity-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Money({ amount, currency, className = "" }) {
  return <span className={`tabular-nums ${className}`}>{formatMoney(amount, currency)}</span>;
}

/** A total at the top of a view: label, figure and one line under it. */
export function Tile({ label, amount, currency, sub = null, extra = null, tone = "neutral", swatch = null, type = null, testId }) {
  const figure = tone === "negative" ? "text-danger" : "text-fg";
  return (
    <div className={`p-3 sm:p-4 rounded-2xl border bg-surface min-w-0 ${TYPE_BORDER[type] || "border-edge"}`} data-testid={testId}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
        {swatch ? <span className="w-2 h-2 rounded-full shrink-0" style={{ background: swatch }} aria-hidden="true" /> : null}
        {label}
      </div>
      <div className={`mt-1 text-lg sm:text-2xl font-bold truncate ${figure}`}>{formatMoney(amount, currency)}</div>
      {sub ? <div className="mt-0.5 text-[11px] sm:text-xs text-fg-muted truncate">{sub}</div> : null}
      {extra ? <div className="text-[11px] sm:text-xs text-fg-muted truncate">{extra}</div> : null}
    </div>
  );
}

/** The round check in front of an entry: paid, received or done, by type. */
export function DoneCheck({ entry, onToggle, disabled = false }) {
  const meta = entryTypeMeta(entry.type);
  const label = entry.done ? `${meta.doneLabel}. Mark as ${meta.undoneLabel.toLowerCase()}` : `Mark as ${meta.doneLabel.toLowerCase()}`;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={entry.done}
      aria-label={label}
      title={label}
      className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        entry.done
          ? "bg-success border-success text-surface"
          : "border-edge-strong text-transparent hover:border-success hover:text-success"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </button>
  );
}

export function Badge({ children, tone = "neutral", title }) {
  const tones = {
    neutral: "bg-surface-2 border-edge text-fg-muted",
    accent: "bg-accent-soft border-accent/40 text-accent",
    warning: "bg-warning-soft border-warning/40 text-warning",
    primary: "bg-primary-soft border-primary/30 text-primary",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-1.5 py-px rounded-full border text-[10px] font-semibold whitespace-nowrap ${tones[tone] || tones.neutral}`}
    >
      {children}
    </span>
  );
}

/** Chart tooltip: the period, then one row per series with its swatch. */
export function ChartTooltip({ active, payload, label, currency, labelFormatter = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg border border-edge bg-surface shadow-lg text-xs">
      <p className="font-semibold text-fg mb-1">{labelFormatter(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-fg-muted">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.payload?.fill }} aria-hidden="true" />
          <span className="flex-1">{p.name}</span>
          <span className="font-semibold text-fg tabular-nums">{formatMoney(p.value, currency)}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          {item.dashed ? (
            <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: item.color }} aria-hidden="true" />
          ) : (
            <span
              className={item.line ? "w-3 h-0.5 rounded-full" : "w-2.5 h-2.5 rounded-sm"}
              style={{ background: item.color }}
              aria-hidden="true"
            />
          )}
          {item.label}
          {item.value ? <span className="font-semibold text-fg">{item.value}</span> : null}
        </span>
      ))}
    </div>
  );
}

export function Panel({ title, action = null, children, type = null, className = "" }) {
  return (
    <section className={`rounded-2xl border bg-surface ${TYPE_BORDER[type] || "border-edge"} ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}
