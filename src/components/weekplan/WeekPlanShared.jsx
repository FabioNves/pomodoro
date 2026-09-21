"use client";

// Shared building blocks for the weekly schedule views (list + calendar):
// popover positioning, minute formatting, icons, the project picker, the
// add/edit task popovers, the notes-on-hover card and the task color bars.

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

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

export function IconCopy({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
    </svg>
  );
}

export function IconDuplicate({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2M14 11v6M11 14h6" />
    </svg>
  );
}

/* ── Projects ──────────────────────────────────────────── */

/**
 * Options for a project picker from the maps the schedule views already
 * keep (id → name, id → swatch class), sorted by name.
 */
export function projectOptionsFrom(projectNameMap = {}, projectColorMap = {}) {
  return Object.entries(projectNameMap)
    .filter(([id, name]) => id && name)
    .map(([id, name]) => ({ id: String(id), name, colorClass: projectColorMap[id] || "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Native select (good on phones) with the chosen project's colour beside it.
 * `emptyLabel` names the "no project of its own" choice ("Same as its cycle"
 * for a cycle task, which then shows under its cycle's project).
 */
export function ProjectSelect({ value, onChange, options = [], className = "", emptyLabel = "No project" }) {
  const current = options.find((o) => o.id === value) || null;
  // A project the list no longer has (deleted, or not loaded yet) is kept
  // rather than silently shown as "No project".
  const orphan = value && !current;
  return (
    <label
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-2 border border-edge focus-within:border-focus ${className}`}
    >
      <span
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${current?.colorClass || "border border-edge-strong"}`}
        aria-hidden="true"
      />
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="Project"
        className="flex-1 min-w-0 bg-transparent text-sm text-fg outline-none cursor-pointer"
      >
        <option value="">{emptyLabel}</option>
        {orphan ? <option value={value}>Other project</option> : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ── Duplicating ───────────────────────────────────────── */

const idString = (v) => (v == null ? null : typeof v === "object" ? String(v._id || v) : String(v));

/**
 * What to add for a copy of a week task: same name, notes, project and slot,
 * not completed. It keeps the link to its cycle, and a copy of a moved cycle
 * task answers for the same occurrence as the original (originDay), so the
 * copy never uses up the occurrence of whatever day it is dragged to.
 */
export function duplicateTaskFields(task) {
  const routineTaskId = idString(task.routineTask);
  return {
    taskName: task.taskName,
    estimatedTime: task.estimatedTime || 0,
    notes: task.notes || "",
    projectId: idString(task.project),
    ...(routineTaskId ? { routineTaskId } : {}),
    ...(Number.isInteger(task.originDay) ? { originDay: task.originDay } : {}),
    // The length as stored: null lets the calendar size the block from the
    // estimate, as it does for the original (an estimate is not always a
    // valid block length, which the API would refuse).
    ...(task.startMinute != null
      ? { startMinute: task.startMinute, durationMinutes: task.durationMinutes ?? null }
      : {}),
  };
}

/* ── Notes on hover ────────────────────────────────────── */

/** Copies text, falling back to a hidden textarea where the async API is missing. */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

const PEEK_WIDTH = 288;

// Beside the task rather than under it, so the card never covers the next
// hours of the same day; under it only when neither side has room.
function peekPosition(rect, height) {
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left;
  let top;
  if (rect.right + margin + PEEK_WIDTH <= vw - margin) {
    left = rect.right + margin;
    top = rect.top;
  } else if (rect.left - margin - PEEK_WIDTH >= margin) {
    left = rect.left - margin - PEEK_WIDTH;
    top = rect.top;
  } else {
    left = Math.min(Math.max(margin, rect.left), vw - PEEK_WIDTH - margin);
    top = rect.bottom + 4;
    if (top + height > vh - margin) top = rect.top - height - 4;
  }
  top = Math.max(margin, Math.min(top, vh - height - margin));
  return { top, left };
}

function NotesPeekCard({ peek, onEnter, onLeave, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const [copied, setCopied] = useState(false);
  const { task, rect, when } = peek;

  useLayoutEffect(() => {
    if (!ref.current) return;
    setPos(peekPosition(rect, ref.current.getBoundingClientRect().height));
  }, [rect, task.notes]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    // The card is placed against where the task was; once anything scrolls
    // that is no longer where it is.
    const onScroll = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      onClose();
    };
    const onDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      // The notes icon toggles the card itself.
      if (e.target?.closest?.("[data-notes-button]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    if (peek.pinned) document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose, peek.pinned]);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Notes for ${task.taskName}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: "fixed",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: PEEK_WIDTH,
        visibility: pos ? "visible" : "hidden",
      }}
      className="z-[9999] bg-surface border border-edge rounded-xl shadow-xl overflow-hidden"
    >
      <div className="flex items-start gap-2 px-3 pt-2.5 pb-2 border-b border-edge">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg leading-snug break-words">{task.taskName}</p>
          {when ? <p className="text-[11px] text-fg-subtle mt-0.5">{when}</p> : null}
        </div>
        <button
          type="button"
          onClick={async () => setCopied(await copyText(task.notes))}
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-colors ${
            copied
              ? "border-success/40 bg-success-soft text-success"
              : "border-edge text-fg-muted hover:text-fg hover:bg-surface-hover"
          }`}
          aria-label={copied ? "Notes copied" : "Copy notes"}
        >
          {copied ? <IconCheck className="w-3.5 h-3.5" /> : <IconCopy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="px-3 py-2.5 max-h-60 overflow-y-auto text-sm text-fg-muted whitespace-pre-wrap break-words select-text [scrollbar-width:thin]">
        {task.notes}
      </p>
    </div>,
    document.body,
  );
}

/**
 * Shows a task's notes in a card beside it while the pointer rests on the
 * task, with a button that copies them. One card per view:
 *
 *   const notes = useNotesPeek();
 *   <div {...notes.bind(task, "09:00 – 10:00")}> … <NotesButton …/> </div>
 *   {notes.card}
 *
 * `bind` opens the card after a short rest (so sweeping across the calendar
 * does not flash cards) and closes it a moment after the pointer leaves,
 * unless it moved onto the card. `pin` opens it at once and keeps it open
 * until a click elsewhere: the way in on a phone, or from the keyboard.
 */
export function useNotesPeek({ openDelay = 400, closeDelay = 180 } = {}) {
  const [peek, setPeek] = useState(null); // { task, rect, when, pinned }
  const openTimer = useRef(0);
  const closeTimer = useRef(0);

  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };
  useEffect(() => clearTimers, []);

  const close = useCallback(() => {
    clearTimers();
    setPeek(null);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPeek((p) => (p?.pinned ? p : null)), closeDelay);
  }, [closeDelay]);

  const keep = useCallback(() => clearTimeout(closeTimer.current), []);

  const bind = useCallback(
    (task, when = "") => {
      if (!task?.notes) return {};
      return {
        onMouseEnter: (e) => {
          const el = e.currentTarget;
          clearTimeout(closeTimer.current);
          clearTimeout(openTimer.current);
          openTimer.current = setTimeout(() => {
            setPeek((p) => (p?.pinned ? p : { task, when, rect: el.getBoundingClientRect(), pinned: false }));
          }, openDelay);
        },
        onMouseLeave: hide,
      };
    },
    [openDelay, hide],
  );

  const pin = useCallback((task, el, when = "") => {
    if (!task?.notes || !el) return;
    clearTimers();
    const anchor = el.closest?.("[data-block]") || el;
    setPeek((p) =>
      p?.pinned && p.task === task ? null : { task, when, rect: anchor.getBoundingClientRect(), pinned: true },
    );
  }, []);

  const card = peek ? <NotesPeekCard peek={peek} onEnter={keep} onLeave={hide} onClose={close} /> : null;
  return { bind, pin, close, card, openFor: peek?.task || null };
}

/** The little notes icon on a task; tapping it opens the notes card. */
export function NotesButton({ task, onPin, className = "" }) {
  if (!task?.notes) return null;
  return (
    <button
      type="button"
      data-notes-button
      className={`shrink-0 text-warning hover:text-accent rounded transition-colors ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onPin?.(e.currentTarget);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label="Show notes"
    >
      <IconNote className="w-3 h-3" />
    </button>
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
  projectColorMap = {},
}) {
  const ref = useRef(null);
  const [mode, setMode] = useState("routine"); // routine | todo | adhoc
  const [adHocName, setAdHocName] = useState("");
  const [adHocTime, setAdHocTime] = useState("");
  // A new task can belong to a project from the start.
  const [adHocProject, setAdHocProject] = useState(projectId || null);
  const projectOptions = projectOptionsFrom(projectNameMap, projectColorMap);
  const [collapsed, setCollapsed] = useState({});
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
  }, [anchorRef, mode, collapsed]);

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

  // Todos grouped by project so each one can be collapsed.
  const todoGroups = (() => {
    const byProject = new Map();
    for (const t of todoTasks) {
      const pid = todoProjectId(t);
      const key = pid || "none";
      if (!byProject.has(key))
        byProject.set(key, { key, projectId: pid || null, tasks: [] });
      byProject.get(key).tasks.push(t);
    }
    return [...byProject.values()]
      .map((g) => ({
        ...g,
        label: g.projectId ? projectNameMap[g.projectId] || "Project" : "No project",
        colorClass: g.projectId ? projectColorMap[g.projectId] : "",
      }))
      .sort((a, b) =>
        a.projectId && !b.projectId
          ? -1
          : !a.projectId && b.projectId
            ? 1
            : a.label.localeCompare(b.label),
      );
  })();

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
          : "w-[240px] max-h-[340px]"
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
        <div className="space-y-1">
          {todoGroups.length ? (
            todoGroups.map((g) => {
              const isOpen = !collapsed[g.key];
              return (
                <div key={g.key}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))
                    }
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle hover:bg-surface-hover hover:text-fg-muted transition-colors"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {g.colorClass ? (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${g.colorClass}`}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="flex-1 min-w-0 truncate">{g.label}</span>
                    <span className="tabular-nums text-fg-subtle/80">
                      {g.tasks.length}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        className="overflow-hidden"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                      >
                        {g.tasks.map((t) => (
                          <button
                            key={t._id}
                            type="button"
                            title={t.title}
                            className="w-full text-left pl-4 pr-2 py-1.5 rounded-lg text-sm text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors"
                            onClick={() => {
                              onAdd({
                                taskName: t.title,
                                estimatedTime: 0,
                                projectId: g.projectId,
                              });
                              onClose();
                            }}
                          >
                            <span className="font-medium line-clamp-2 break-words">
                              {t.title}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
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
                  projectId: adHocProject || null,
                });
                onClose();
              }
            }}
          />
          {projectOptions.length ? (
            <ProjectSelect value={adHocProject} onChange={setAdHocProject} options={projectOptions} />
          ) : null}
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
                projectId: adHocProject || null,
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

/**
 * The task "⋮" menu: edit its name, time, project and notes, duplicate it,
 * or delete it. `projectId` is the project the task shows under (its own, or
 * that of its cycle); `projectOptions` come from projectOptionsFrom().
 */
export function TaskEditPopover({
  task,
  onSave,
  onDelete,
  onDuplicate = null,
  onClose,
  anchorRef,
  projectId = null,
  inheritLabel = null,
  projectOptions = [],
}) {
  const ref = useRef(null);
  const [name, setName] = useState(task?.taskName || "");
  const [project, setProject] = useState(projectId || null);
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
      // Only sent when changed. `projectId` is the project of the task
      // itself; a cycle task without one follows its cycle.
      ...((project || null) !== (projectId || null) ? { projectId: project || null } : {}),
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
        {projectOptions.length ? (
          <ProjectSelect
            value={project}
            onChange={setProject}
            options={projectOptions}
            emptyLabel={inheritLabel || "No project"}
          />
        ) : null}
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
          {onDuplicate ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-edge text-fg-muted text-xs font-medium hover:text-fg hover:bg-surface-hover"
              onClick={() => {
                onDuplicate();
                onClose();
              }}
              aria-label="Duplicate task"
              title="Duplicate task"
            >
              <IconDuplicate className="w-3.5 h-3.5" />
              Duplicate
            </button>
          ) : null}
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
