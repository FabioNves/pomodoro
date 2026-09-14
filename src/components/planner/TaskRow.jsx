"use client";

// Task row shared by every planner view (board column, project page, list),
// with the helpers and icons it needs. Extracted from src/app/planner/page.js.

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getMondayOf } from "@/utils/timeUtils";
import { formatDateRange, isInvalidRange } from "@/lib/milestones";

export function IconChevron({ open, className = "" }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.15 }}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </motion.svg>
  );
}

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

export function IconDots({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
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

export function IconCalendar({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

/* Format/parse helpers for Task.scheduledDate (stored as ISO Date) */
export function formatDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateDisplay(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* Monday-based start of the week containing the given date (local time) */
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const jsDay = d.getDay(); // 0=Sun..6=Sat
  const offset = jsDay === 0 ? 6 : jsDay - 1; // days since Monday
  d.setDate(d.getDate() - offset);
  return d;
}

export function isInCurrentWeek(dateValue) {
  if (!dateValue) return true; // no date = treat as "this week / unscheduled"
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return true;
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return d >= start && d < end;
}

export function ToggleCircle({ checked, onToggle }) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
        checked
          ? "bg-primary border-primary"
          : "bg-transparent border-edge"
      }`}
      whileTap={{ scale: 0.95 }}
      aria-pressed={checked}
      aria-label={checked ? "Mark as not completed" : "Mark as completed"}
    >
      {checked ? (
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary-fg)"
          strokeWidth="3"
          className="w-3.5 h-3.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.2 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </motion.svg>
      ) : null}
    </motion.button>
  );
}

export function compareTasksByOrder(a, b) {
  const ao = Number.isFinite(a?.order) ? a.order : 0;
  const bo = Number.isFinite(b?.order) ? b.order : 0;
  if (ao !== bo) return ao - bo;
  const ad = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bd = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return ad - bd;
}

export function TaskRow({
  task,
  subtasks,
  onToggle,
  onCreateSubtask,
  onDeleteTask,
  onMoveTask,
  onSetScheduledDate,
  onSetDates,
  projectId,
  depth = 0,
  scheduledForLater = false,
  milestones = [],
  onSetMilestone,
  onRenameTask,
  showMilestoneBadge = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const [showRangeInput, setShowRangeInput] = useState(false);
  const [rangeDraft, setRangeDraft] = useState({ start: "", end: "" });
  const [showMilestonePicker, setShowMilestonePicker] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  const milestoneId = task.milestone
    ? String(task.milestone?._id || task.milestone)
    : "";
  const milestoneName = showMilestoneBadge
    ? milestones.find((m) => String(m._id) === milestoneId)?.name || null
    : null;

  const canDrag = depth === 0 && !task.completed && !task.parentTask;
  const scheduledDateValue = formatDateInput(task.scheduledDate);
  const scheduledDateDisplay = formatDateDisplay(task.scheduledDate);
  const hasRange = Boolean(task.startDate || task.endDate);
  const rangeDisplay = formatDateRange(task.startDate, task.endDate);
  const rangeInvalid = isInvalidRange(rangeDraft.start, rangeDraft.end);
  const saveRange = () => {
    if (rangeInvalid) return;
    onSetDates?.(task, {
      startDate: rangeDraft.start || null,
      endDate: rangeDraft.end || null,
    });
    setShowRangeInput(false);
  };

  useEffect(() => {
    if (menuOpen) {
      const closeMenu = () => setMenuOpen(false);
      document.addEventListener("click", closeMenu);
      return () => document.removeEventListener("click", closeMenu);
    }
  }, [menuOpen]);

  return (
    <div>
      <div
        className={`group flex items-start gap-2 py-1.5 rounded-md hover:bg-surface-hover transition-colors px-2 ${
          depth > 0 ? "ml-5" : ""
        } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
        draggable={canDrag}
        onDragStart={(e) => {
          if (!canDrag) return;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(task._id));
        }}
        onDragOver={(e) => {
          if (depth !== 0 || task.completed || task.parentTask) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          if (depth !== 0 || task.completed || task.parentTask) return;
          e.preventDefault();
          e.stopPropagation();
          const draggedId = e.dataTransfer.getData("text/plain");
          if (!draggedId) return;
          if (String(draggedId) === String(task._id)) return;
          onMoveTask?.({
            taskId: draggedId,
            toProjectId: projectId,
            beforeTaskId: task._id,
            scheduledForLater,
          });
        }}
      >
        <div className="pt-0.5">
          <ToggleCircle
            checked={task.completed}
            onToggle={() => onToggle(task)}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div
            className={`text-sm leading-5 break-words ${
              task.completed
                ? "text-fg-subtle line-through"
                : "text-fg"
            }`}
          >
            {task.title}
          </div>
          {milestoneName || hasRange ? (
            <div className="text-[11px] text-fg-subtle truncate">
              {[milestoneName, rangeDisplay].filter(Boolean).join(" · ")}
            </div>
          ) : null}
        </div>

        {task.scheduledDate ? (
          <span
            className="shrink-0 text-primary self-center"
            title={`Scheduled for ${scheduledDateDisplay}`}
            aria-label={`Scheduled for ${scheduledDateDisplay}`}
          >
            <IconCalendar className="w-3.5 h-3.5" />
          </span>
        ) : null}

        <div className="relative">
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-fg-subtle hover:text-fg p-1"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-label="Task menu"
          >
            <IconDots className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {menuOpen ? (
              <motion.div
                className="absolute right-0 mt-1 w-40 bg-surface border border-edge rounded-lg shadow-lg overflow-hidden z-20"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowSubtaskInput(true);
                  }}
                >
                  Create subtask
                </button>
                {onRenameTask ? (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover"
                    onClick={() => {
                      setMenuOpen(false);
                      setRenameDraft(task.title || "");
                      setShowRename(true);
                    }}
                  >
                    {"Rename\u2026"}
                  </button>
                ) : null}
                {onSetMilestone && depth === 0 && !task.parentTask && milestones.length ? (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowMilestonePicker(true);
                    }}
                  >
                    {"Move to milestone\u2026"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover"
                  onClick={() => {
                    setMenuOpen(false);
                    setDateDraft(scheduledDateValue);
                    setShowDateInput(true);
                  }}
                >
                  {task.scheduledDate ? "Change date\u2026" : "Set date\u2026"}
                </button>
                {task.scheduledDate ? (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover"
                    onClick={() => {
                      setMenuOpen(false);
                      onSetScheduledDate?.(task, null);
                    }}
                  >
                    Clear date
                  </button>
                ) : null}
                {onSetDates ? (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover"
                    onClick={() => {
                      setMenuOpen(false);
                      setRangeDraft({
                        start: formatDateInput(task.startDate),
                        end: formatDateInput(task.endDate),
                      });
                      setShowRangeInput(true);
                    }}
                  >
                    {hasRange ? "Change start/end…" : "Set start/end…"}
                  </button>
                ) : null}
                {onSetDates && hasRange ? (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover"
                    onClick={() => {
                      setMenuOpen(false);
                      onSetDates(task, { startDate: null, endDate: null });
                    }}
                  >
                    Clear start/end
                  </button>
                ) : null}
                <div className="border-t border-edge" />
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-surface-hover"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteTask?.(task);
                  }}
                >
                  Delete task
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showSubtaskInput ? (
          <motion.div
            className="ml-8 mt-1 flex gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <input
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              placeholder="New subtask"
              className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const title = subtaskTitle.trim();
                  if (!title) return;
                  onCreateSubtask(task, title);
                  setSubtaskTitle("");
                  setShowSubtaskInput(false);
                }
                if (e.key === "Escape") setShowSubtaskInput(false);
              }}
              autoFocus
            />
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm"
              onClick={() => {
                const title = subtaskTitle.trim();
                if (!title) return;
                onCreateSubtask(task, title);
                setSubtaskTitle("");
                setShowSubtaskInput(false);
              }}
            >
              Add
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showRename ? (
          <motion.div
            className="ml-8 mt-1 flex gap-2 items-center"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
              aria-label="Task name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const title = renameDraft.trim();
                  if (title && title !== task.title) onRenameTask?.(task, title);
                  setShowRename(false);
                }
                if (e.key === "Escape") setShowRename(false);
              }}
              autoFocus
            />
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm"
              onClick={() => {
                const title = renameDraft.trim();
                if (title && title !== task.title) onRenameTask?.(task, title);
                setShowRename(false);
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm"
              onClick={() => setShowRename(false)}
            >
              Cancel
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showMilestonePicker ? (
          <motion.div
            className="ml-8 mt-1 flex gap-2 items-center"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <select
              defaultValue={milestoneId}
              className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
              aria-label="Milestone"
              autoFocus
              onChange={(e) => {
                onSetMilestone?.(task, e.target.value || null);
                setShowMilestonePicker(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowMilestonePicker(false);
              }}
            >
              <option value="">Unassigned</option>
              {milestones.map((m) => (
                <option key={m._id} value={String(m._id)}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm"
              onClick={() => setShowMilestonePicker(false)}
            >
              Cancel
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showDateInput ? (
          <motion.div
            className="ml-8 mt-1 flex gap-2 items-center"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <input
              type="date"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSetScheduledDate?.(task, dateDraft || null);
                  setShowDateInput(false);
                }
                if (e.key === "Escape") setShowDateInput(false);
              }}
              autoFocus
            />
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm"
              onClick={() => {
                onSetScheduledDate?.(task, dateDraft || null);
                setShowDateInput(false);
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm"
              onClick={() => setShowDateInput(false)}
            >
              Cancel
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showRangeInput ? (
          <motion.div
            className="ml-8 mt-1 flex flex-wrap gap-2 items-center"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveRange();
              }
              if (e.key === "Escape") setShowRangeInput(false);
            }}
          >
            <label className="flex items-center gap-1.5 text-xs text-fg-muted">
              Start
              <input
                type="date"
                value={rangeDraft.start}
                max={rangeDraft.end || undefined}
                onChange={(e) => setRangeDraft((d) => ({ ...d, start: e.target.value }))}
                className="px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
                autoFocus
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-fg-muted">
              End
              <input
                type="date"
                value={rangeDraft.end}
                min={rangeDraft.start || undefined}
                onChange={(e) => setRangeDraft((d) => ({ ...d, end: e.target.value }))}
                className="px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
              />
            </label>
            {rangeInvalid ? (
              <span className="text-xs text-danger">End is before start.</span>
            ) : null}
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm disabled:opacity-50"
              onClick={saveRange}
              disabled={rangeInvalid}
            >
              Save
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-surface-2 text-fg text-sm"
              onClick={() => setShowRangeInput(false)}
            >
              Cancel
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {subtasks?.length ? (
        <div className="mt-0.5">
          {subtasks.map((st) => (
            <TaskRow
              key={st._id}
              task={st}
              subtasks={[]}
              onToggle={onToggle}
              onCreateSubtask={onCreateSubtask}
              onDeleteTask={onDeleteTask}
              onMoveTask={onMoveTask}
              onSetScheduledDate={onSetScheduledDate}
              onSetDates={onSetDates}
              onRenameTask={onRenameTask}
              projectId={projectId}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AddTaskModal({
  open,
  projectName,
  milestoneName = null,
  title,
  setTitle,
  date,
  setDate,
  onCancel,
  onSubmit,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="add-task-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onCancel?.();
          }}
        >
          <motion.div
            className="w-full max-w-sm bg-surface border border-edge rounded-2xl shadow-xl overflow-hidden"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
          >
                <div className="px-5 pt-4 pb-2">
                  <h3 className="text-base font-semibold text-fg">
                    New task
                  </h3>
                  {projectName ? (
                    <p className="text-xs text-fg-subtle mt-0.5 truncate">
                      in {projectName}
                      {milestoneName ? ` \u00b7 ${milestoneName}` : ""}
                    </p>
                  ) : null}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit?.();
                  }}
                  className="px-5 pb-5 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">
                      Title
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Task title"
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none focus:ring-2 focus:ring-focus/40"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">
                      Date <span className="text-fg-subtle">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none focus:ring-2 focus:ring-focus/40"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onCancel}
                      className="px-3 py-2 rounded-lg bg-surface-2 text-fg text-sm hover:bg-surface-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!title.trim()}
                      className="px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add task
                    </button>
                  </div>
                </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
