"use client";

// Building blocks shared by the Business screens: the status pill and glyph,
// the progress bar and a few icons. The generic controls (buttons, spinner,
// switch, the "…" menu, form fields) are the ones the news and notebook
// screens use, re-exported here so business components import from one
// place. Dialogs use the planner's ModalShell, a bottom sheet on phones.

import React from "react";
import { STATUS_PILL_CLASS } from "@/lib/milestones";
import { statusMeta } from "@/lib/business/phases";

export {
  ActionButton,
  Spinner,
  Toggle,
  IconPlus,
  IconX,
  IconAlert,
  relativeTime,
} from "@/components/news/newsUi";

export {
  PopoverMenu,
  Field,
  inputClass,
  IconTrash,
  IconEdit,
  IconBack,
  IconExternal,
  IconArrowUp,
  IconArrowDown,
} from "@/components/notebook/notebookUi";

export { IconLock } from "@/components/access/Gate";

/* ── icons ─────────────────────────────────────────────── */

const icon = (path, extra = null) =>
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
        {extra}
      </svg>
    );
  };

export const IconBusiness = icon("M4 8h16a1 1 0 011 1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a1 1 0 011-1zM9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18M12 12v2");
export const IconArrowRight = icon("M5 12h14M13 6l6 6-6 6");
export const IconUnlock = icon("M8 11V7a4 4 0 017.5-2", <rect x="5" y="11" width="14" height="10" rx="2" />);
export const IconLoop = icon("M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3");

/* ── status ────────────────────────────────────────────── */

// The milestone pills plus the solid one a completed phase or item gets, so
// "Ready" (soft green: go) and "Completed" (solid green: done) read apart.
// The text takes the surface colour rather than white: the dark themes have a
// light green, on which white cannot be read.
const PILL_CLASS = {
  ...STATUS_PILL_CLASS,
  done: "bg-success text-surface border-success",
};

/**
 * The mark in front of a status, so colour is never the only signal:
 * ○ not started, ◐ in progress, a lock when blocked, ▸ ready, ✓ completed.
 */
export function StatusGlyph({ status, className = "w-3 h-3" }) {
  if (status === "completed") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === "blocked") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 018 0v4" />
      </svg>
    );
  }
  if (status === "ready") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M8 5l11 7-11 7V5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      {status === "in_progress" ? <path d="M12 4a8 8 0 010 16z" fill="currentColor" stroke="none" /> : null}
    </svg>
  );
}

export function StatusPill({ status, className = "" }) {
  const meta = statusMeta(status);
  return (
    <span
      title={meta.hint}
      data-status={status}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
        PILL_CLASS[meta.tone] || PILL_CLASS.muted
      } ${className}`}
    >
      <StatusGlyph status={status} className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  );
}

const STATUS_TEXT_CLASS = {
  not_started: "text-fg-subtle",
  in_progress: "text-primary",
  blocked: "text-warning",
  ready: "text-success",
  completed: "text-success",
};

export function statusTextClass(status) {
  return STATUS_TEXT_CLASS[status] || STATUS_TEXT_CLASS.not_started;
}

/** Progress of a phase or of the business. Amber while blocked, green once complete. */
export function ProgressBar({ percent = 0, status, size = "sm", label, className = "" }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const fill = status === "completed" || p === 100 ? "bg-success" : status === "blocked" ? "bg-warning" : "bg-primary";
  return (
    <div
      className={`${size === "lg" ? "h-2.5" : "h-1.5"} w-full rounded-full bg-edge/70 overflow-hidden ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full transition-[width] duration-500 ${fill}`} style={{ width: `${p}%` }} />
    </div>
  );
}

/** Small uppercase heading used above each block of the overview. */
export function BlockTitle({ children, action = null, hint = null }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-2.5">
      <div className="min-w-0">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{children}</h2>
        {hint ? <p className="text-xs text-fg-muted mt-0.5">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** The plain card every block sits in. */
export function Panel({ children, className = "" }) {
  return <section className={`bg-surface border border-edge rounded-2xl shadow-sm ${className}`}>{children}</section>;
}
