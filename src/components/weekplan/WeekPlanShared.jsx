"use client";

// Shared building blocks for the weekly schedule views (list + calendar):
// popover positioning, minute formatting, icons, the add/edit task popovers
// and the task color bars.

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

// Compute a viewport-aware popover position anchored under an element.
// Flips above if not enough room below; right-aligns if not enough room right.
export function computePopoverPosition(anchorEl, popW, popH) {
  if (!anchorEl) return { top: 0, left: 0 };
  const margin = 8;
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = rect.bottom + 4;
  if (top + popH > vh - margin) {
    const above = rect.top - popH - 4;
    top = above >= margin ? above : Math.max(margin, vh - popH - margin);
  }

  let left = rect.left;
  if (left + popW > vw - margin) {
    left = rect.right - popW;
  }
  left = Math.max(margin, Math.min(left, vw - popW - margin));

  return { top, left };
}

export function formatMinutes(m) {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h && min) return `${h}h${min}m`;
  if (h) return `${h}h`;
  return `${min}m`;
}

/** 570 → "09:30" (clock time from minutes after midnight). */
export function minutesToTime(m) {
  if (m == null || Number.isNaN(m)) return "";
  const clamped = Math.max(0, Math.min(1439, Math.round(m)));
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "09:30" → 570, or null for an empty/invalid value. */
export function timeToMinutes(str) {
  if (!str || typeof str !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Block length used by the calendar when a task has no explicit duration. */
export const DEFAULT_BLOCK_MINUTES = 60;
export function taskDuration(task) {
  if (task?.durationMinutes) return task.durationMinutes;
  if (task?.estimatedTime) return task.estimatedTime;
  return DEFAULT_BLOCK_MINUTES;
}

/* ── Icons ─────────────────────────────────────────────── */

export function IconPlus({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconTrash({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
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
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function IconDotsVertical({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

export function IconNote({ className = "" }) {
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
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-6 4h4"
      />
    </svg>
  );
}

/* ── Add Task Popover ──────────────────────────────────── */

export function AddTaskPopover({
  routineTasks,
  todoTasks = [],
  onAdd,
  onClose,
  anchorRef,
  projectId = null,
  projectNameMap = {},
}) {
  const ref = useRef(null);
  const [mode, setMode] = useState("routine"); // routine | todo | adhoc
  const [adHocName, setAdHocName] = useState("");
  const [adHocTime, setAdHocTime] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false });

  useLayoutEffect(() => {
    if (!ref.current || !anchorRef?.current) return;
    const rect = ref.current.getBoundingClientRect();
    const { top, left } = computePopoverPosition(
      anchorRef.current,
      rect.width,
      rect.height,
    );
    setPos({ top, left, ready: true });
  }, [anchorRef, mode]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Resolve the project id of a todo task (preserves source project when picked).
  const todoProjectId = (t) => {
    if (!t?.project) return projectId;
    return typeof t.project === "object"
      ? String(t.project._id || t.project)
      : String(t.project);
  };

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        visibility: pos.ready ? "visible" : "hidden",
      }}
      className={`z-[9999] bg-surface border border-edge rounded-xl shadow-xl p-3 overflow-x-hidden overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-edge ${
        // Todo titles are long: give that mode a much wider, taller panel.
        mode === "todo"
          ? "w-[min(420px,calc(100vw-24px))] max-h-[420px]"
          : "w-[220px] max-h-[300px]"
      }`}
    >
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === "routine"
              ? "bg-primary-soft text-primary"
              : "text-fg-subtle hover:bg-surface-hover"
          }`}
          onClick={() => setMode("routine")}
        >
          Routine
        </button>
        <button
          type="button"
          className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === "todo"
              ? "bg-primary-soft text-primary"
              : "text-fg-subtle hover:bg-surface-hover"
          }`}
          onClick={() => setMode("todo")}
        >
          Todo
        </button>
        <button
          type="button"
          className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === "adhoc"
              ? "bg-primary-soft text-primary"
              : "text-fg-subtle hover:bg-surface-hover"
          }`}
          onClick={() => setMode("adhoc")}
        >
          Add
        </button>
      </div>

      {mode === "routine" ? (
        <div className="space-y-1">
          {routineTasks.length ? (
            routineTasks.map((rt) => (
              <button
                key={rt._id}
                type="button"
                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-surface-hover transition-colors"
                onClick={() => {
                  const rtPid =
                    typeof rt.project === "object"
                      ? String(rt.project?._id || rt.project)
                      : rt.project
                        ? String(rt.project)
                        : projectId;
                  onAdd({
                    routineTaskId: rt._id,
                    projectId: rtPid || null,
                    taskName: rt.title,
                    estimatedTime: rt.estimatedTime || 0,
                  });
                  onClose();
                }}
              >
                <div className="font-medium">{rt.title}</div>
                {rt.estimatedTime ? (
                  <div className="text-xs text-fg-subtle">
                    {formatMinutes(rt.estimatedTime)}
                  </div>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-fg-subtle">
              No routine tasks found
            </div>
          )}
        </div>
      ) : mode === "todo" ? (
        <div className="space-y-0.5">
          {todoTasks.length ? (
            todoTasks.map((t) => {
              const pid = todoProjectId(t);
              const projectName = pid ? projectNameMap[pid] : null;
              return (
                <button
                  key={t._id}
                  type="button"
                  title={t.title}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-surface-hover transition-colors"
                  onClick={() => {
                    onAdd({
                      taskName: t.title,
                      estimatedTime: 0,
                      projectId: pid,
                    });
                    onClose();
                  }}
                >
                  <div className="font-medium line-clamp-2 break-words">
                    {t.title}
                  </div>
                  {projectName ? (
                    <div className="text-[11px] text-fg-subtle truncate">
                      {projectName}
                    </div>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="px-2 py-2 text-xs text-fg-subtle">
              No pending tasks
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={adHocName}
            onChange={(e) => setAdHocName(e.target.value)}
            placeholder="Task name"
            className="w-full px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && adHocName.trim()) {
                onAdd({
                  taskName: adHocName.trim(),
                  estimatedTime: adHocTime ? Number(adHocTime) : 0,
                  projectId: projectId || null,
                });
                onClose();
              }
            }}
          />
          <input
            type="number"
            value={adHocTime}
            onChange={(e) => setAdHocTime(e.target.value)}
            placeholder="Time (min)"
            className="w-full px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
            min="0"
          />
          <button
            type="button"
            className="w-full px-2 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium"
            onClick={() => {
              if (!adHocName.trim()) return;
              onAdd({
                taskName: adHocName.trim(),
                estimatedTime: adHocTime ? Number(adHocTime) : 0,
                projectId: projectId || null,
              });
              onClose();
            }}
          >
            Add
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}

/* ── Task Edit Popover ─────────────────────────────────── */

export function TaskEditPopover({ task, onSave, onDelete, onClose, anchorRef }) {
  const ref = useRef(null);
  const [name, setName] = useState(task?.taskName || "");
  const [time, setTime] = useState(
    task?.estimatedTime ? String(task.estimatedTime) : "",
  );
  const [notes, setNotes] = useState(task?.notes || "");
  const [startTime, setStartTime] = useState(
    task?.startMinute != null ? minutesToTime(task.startMinute) : "",
  );
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false });

  useLayoutEffect(() => {
    if (!ref.current || !anchorRef?.current) return;
    const rect = ref.current.getBoundingClientRect();
    const { top, left } = computePopoverPosition(
      anchorRef.current,
      rect.width,
      rect.height,
    );
    setPos({ top, left, ready: true });
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      taskName: trimmed,
      estimatedTime: time ? Number(time) || 0 : 0,
      notes,
      startMinute: startTime ? timeToMinutes(startTime) : null,
    });
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        visibility: pos.ready ? "visible" : "hidden",
      }}
      className="z-[9999] bg-surface border border-edge rounded-xl shadow-xl p-3 w-[260px]"
    >
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Task name"
          className="w-full px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) handleSave();
            if (e.key === "Escape") onClose();
          }}
        />
        <input
          type="number"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="Time (min)"
          min="0"
          className="w-full px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-subtle shrink-0">Start</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm text-fg outline-none"
            aria-label="Start time"
          />
          {startTime ? (
            <button
              type="button"
              className="text-xs text-fg-subtle hover:text-danger shrink-0"
              onClick={() => setStartTime("")}
              title="Remove start time"
            >
              Clear
            </button>
          ) : null}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (shown on hover)"
          rows={3}
          className="w-full px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm outline-none resize-none"
        />
        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            className="flex-1 px-2 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-xs font-medium"
            onClick={handleSave}
          >
            Save
          </button>
          <button
            type="button"
            className="px-2 py-1.5 rounded-lg border border-danger/40 text-danger text-xs font-medium hover:bg-danger-soft"
            onClick={() => {
              onDelete();
              onClose();
            }}
            aria-label="Delete task"
            title="Delete task"
          >
            <IconTrash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Color Lines (vertical bars for task colors) ───────── */

export function TaskColorLines({ manualColor, conditionalColor }) {
  if (!manualColor && !conditionalColor) return null;
  return (
    <div className="flex gap-0.5 shrink-0 self-stretch">
      {manualColor ? (
        <div
          className="w-[3px] rounded-full"
          style={{ backgroundColor: manualColor }}
        />
      ) : null}
      {conditionalColor ? (
        <div
          className="w-[3px] rounded-full"
          style={{ backgroundColor: conditionalColor }}
        />
      ) : null}
    </div>
  );
}
