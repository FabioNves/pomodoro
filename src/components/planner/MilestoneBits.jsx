"use client";

// Small milestone widgets shared by the board column, the project page,
// the roadmap and the manage modal.

import React from "react";
import {
  STATUS_PILL_CLASS,
  daysUntil,
  formatDateRange,
  milestoneStatusMeta,
} from "@/lib/milestones";

export function StatusPill({ status, className = "" }) {
  const meta = milestoneStatusMeta(status);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${
        STATUS_PILL_CLASS[meta.tone]
      } ${className}`}
    >
      {meta.label}
    </span>
  );
}

export function ProgressBar({ percent = 0, status, className = "" }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const fill =
    status === "completed" || p === 100
      ? "bg-success"
      : status === "on_hold"
        ? "bg-warning"
        : "bg-primary";
  return (
    <div
      className={`h-1.5 w-full rounded-full bg-edge/70 overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full transition-[width] ${fill}`} style={{ width: `${p}%` }} />
    </div>
  );
}

/** "3/7 tasks · Oct 1 – Oct 15 · 5d left" */
export function MilestoneMeta({ milestone, progress, className = "" }) {
  const parts = [];
  if (progress) {
    parts.push(progress.total ? `${progress.done}/${progress.total} tasks` : "No tasks yet");
  }
  const range = formatDateRange(milestone?.startDate, milestone?.endDate);
  if (range) parts.push(range);
  const days =
    milestone?.status === "completed" ? null : daysUntil(milestone?.endDate);
  if (days !== null) {
    parts.push(days < 0 ? `${-days}d overdue` : days === 0 ? "Due today" : `${days}d left`);
  }
  if (!parts.length) return null;
  const overdue = days !== null && days < 0;
  return (
    <div className={`text-[11px] ${overdue ? "text-danger" : "text-fg-subtle"} ${className}`}>
      {parts.join(" · ")}
    </div>
  );
}

export function IconSparkle({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15zM5 15l.7 1.6L7.3 17.3 5.7 18 5 19.6 4.3 18 2.7 17.3 4.3 16.6 5 15z"
      />
    </svg>
  );
}

export function IconFlag({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4m0 0h11l-2 4 2 4H5" />
    </svg>
  );
}

export function IconCheck({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** Round complete/uncomplete toggle for a milestone. */
export function MilestoneToggle({ completed, onToggle, size = "w-5 h-5" }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      className={`${size} shrink-0 rounded-full border flex items-center justify-center transition-colors ${
        completed
          ? "bg-success border-success text-white"
          : "bg-transparent border-edge-strong text-transparent hover:text-fg-subtle"
      }`}
      aria-pressed={completed}
      aria-label={completed ? "Mark milestone as not completed" : "Mark milestone as complete"}
      title={completed ? "Mark as not completed" : "Mark as complete"}
    >
      <IconCheck className="w-3 h-3" />
    </button>
  );
}
