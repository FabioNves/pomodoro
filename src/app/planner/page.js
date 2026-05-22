"use client";

import React, {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { jwtDecode } from "jwt-decode";
import { generateSessionId } from "@/utils/sessionUtils";
import WeeklyRoutine from "@/components/WeeklyRoutine";
import RoutineTasksView from "@/components/RoutineTasksView";

/* ╔══════════════════════════════════════════════════════╗
   ║  Shared API helpers                                  ║
   ╚══════════════════════════════════════════════════════╝ */

function getIdentityHeaders() {
  if (typeof window === "undefined") return {};
  const userId = localStorage.getItem("userId");
  if (userId) return { "user-id": userId };
  return { "session-id": generateSessionId() };
}

async function apiJson(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...getIdentityHeaders(),
    "Content-Type": "application/json",
  };
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ╔══════════════════════════════════════════════════════╗
   ║  Shared icons                                        ║
   ╚══════════════════════════════════════════════════════╝ */

function IconChevron({ open, className = "" }) {
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

function IconPlus({ className = "" }) {
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

function IconTrash({ className = "" }) {
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

function IconDots({ className = "" }) {
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

function IconDotsVertical({ className = "" }) {
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

function IconCalendar({ className = "" }) {
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
function formatDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(value) {
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
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const jsDay = d.getDay(); // 0=Sun..6=Sat
  const offset = jsDay === 0 ? 6 : jsDay - 1; // days since Monday
  d.setDate(d.getDate() - offset);
  return d;
}

function isInCurrentWeek(dateValue) {
  if (!dateValue) return true; // no date = treat as "this week / unscheduled"
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return true;
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return d >= start && d < end;
}

/* ╔══════════════════════════════════════════════════════╗
   ║  TASKS TAB — colors, components, helpers             ║
   ╚══════════════════════════════════════════════════════╝ */

const PROJECT_COLORS = [
  {
    key: "blue",
    label: "Blue",
    swatchClass: "bg-blue-500",
    headerClass: "bg-blue-500/30 dark:bg-blue-400/25",
    borderClass: "border-blue-500/20 dark:border-blue-400/30",
  },
  {
    key: "green",
    label: "Green",
    swatchClass: "bg-green-500",
    headerClass: "bg-green-500/30 dark:bg-green-400/25",
    borderClass: "border-green-500/20 dark:border-green-400/30",
  },
  {
    key: "red",
    label: "Red",
    swatchClass: "bg-red-500",
    headerClass: "bg-red-500/30 dark:bg-red-400/25",
    borderClass: "border-red-500/20 dark:border-red-400/30",
  },
  {
    key: "orange",
    label: "Orange",
    swatchClass: "bg-orange-500",
    headerClass: "bg-orange-500/30 dark:bg-orange-400/25",
    borderClass: "border-orange-500/20 dark:border-orange-400/30",
  },
  {
    key: "purple",
    label: "Purple",
    swatchClass: "bg-purple-500",
    headerClass: "bg-purple-500/30 dark:bg-purple-400/25",
    borderClass: "border-purple-500/20 dark:border-purple-400/30",
  },
  {
    key: "gray",
    label: "Gray",
    swatchClass: "bg-gray-500",
    headerClass: "bg-gray-500/30 dark:bg-gray-400/25",
    borderClass: "border-gray-500/20 dark:border-gray-400/30",
  },
];

function getProjectColorMeta(headerColor) {
  return PROJECT_COLORS.find((c) => c.key === headerColor) || PROJECT_COLORS[0];
}

function ProjectOptionsMenu({ project, onDelete, onSetColor }) {
  return (
    <motion.div
      className="w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Header color
      </div>
      <div className="px-3 pb-2 grid grid-cols-6 gap-2">
        {PROJECT_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`w-5 h-5 rounded-full ${c.swatchClass} border border-white/40 dark:border-black/20 hover:scale-105 transition-transform`}
            aria-label={`Set color to ${c.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onSetColor(project, c.key);
            }}
          />
        ))}
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700" />
      <button
        type="button"
        className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(project);
        }}
      >
        Delete project
      </button>
    </motion.div>
  );
}

function ToggleCircle({ checked, onToggle }) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
        checked
          ? "bg-[#014acd] border-[#014acd]"
          : "bg-transparent border-gray-300 dark:border-gray-600"
      }`}
      whileTap={{ scale: 0.95 }}
      aria-pressed={checked}
      aria-label={checked ? "Mark as not completed" : "Mark as completed"}
    >
      {checked ? (
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
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

function compareTasksByOrder(a, b) {
  const ao = Number.isFinite(a?.order) ? a.order : 0;
  const bo = Number.isFinite(b?.order) ? b.order : 0;
  if (ao !== bo) return ao - bo;
  const ad = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bd = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return ad - bd;
}

function TaskRow({
  task,
  subtasks,
  onToggle,
  onCreateSubtask,
  onDeleteTask,
  onMoveTask,
  onSetScheduledDate,
  projectId,
  depth = 0,
  scheduledForLater = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateDraft, setDateDraft] = useState("");

  const canDrag = depth === 0 && !task.completed && !task.parentTask;
  const scheduledDateValue = formatDateInput(task.scheduledDate);
  const scheduledDateDisplay = formatDateDisplay(task.scheduledDate);

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
        className={`group flex items-start gap-2 py-1.5 rounded-md hover:bg-white/70 dark:hover:bg-gray-800/40 transition-colors px-2 ${
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
                ? "text-gray-500 dark:text-gray-400 line-through"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {task.title}
          </div>
        </div>

        {task.scheduledDate ? (
          <span
            className="shrink-0 text-[#2563eb] dark:text-blue-400 self-center"
            title={`Scheduled for ${scheduledDateDisplay}`}
            aria-label={`Scheduled for ${scheduledDateDisplay}`}
          >
            <IconCalendar className="w-3.5 h-3.5" />
          </span>
        ) : null}

        <div className="relative">
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1"
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
                className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-20"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowSubtaskInput(true);
                  }}
                >
                  Create subtask
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
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
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      setMenuOpen(false);
                      onSetScheduledDate?.(task, null);
                    }}
                  >
                    Clear date
                  </button>
                ) : null}
                <div className="border-t border-gray-200 dark:border-gray-700" />
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800"
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
              className="flex-1 px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
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
              className="px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm"
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
              className="flex-1 px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
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
              className="px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm"
              onClick={() => {
                onSetScheduledDate?.(task, dateDraft || null);
                setShowDateInput(false);
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
              onClick={() => setShowDateInput(false)}
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
              projectId={projectId}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AddTaskModal({
  open,
  projectName,
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
            className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
          >
                <div className="px-5 pt-4 pb-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    New task
                  </h3>
                  {projectName ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      in {projectName}
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
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      Title
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Task title"
                      className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/40"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      Date <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/40"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onCancel}
                      className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!title.trim()}
                      className="px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

function ProjectColumn({
  project,
  tasks,
  onAddTask,
  onToggleTask,
  onCreateSubtask,
  onDeleteTask,
  onDeleteProject,
  onSetProjectColor,
  onMoveTask,
  onSetScheduledDate,
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (projectMenuOpen) {
      const closeMenu = () => setProjectMenuOpen(false);
      document.addEventListener("click", closeMenu);
      return () => document.removeEventListener("click", closeMenu);
    }
  }, [projectMenuOpen]);

  const { thisWeekTasks, laterTasks, completedTopLevel, subtasksByParent } =
    useMemo(() => {
      const topLevel = [...tasks]
        .filter((t) => !t.parentTask)
        .sort(compareTasksByOrder);
      const childrenByParent = new Map();
      for (const t of tasks) {
        if (!t.parentTask) continue;
        const parentId = String(t.parentTask);
        const list = childrenByParent.get(parentId) || [];
        list.push(t);
        childrenByParent.set(parentId, list);
      }
      for (const [k, list] of childrenByParent.entries()) {
        childrenByParent.set(k, [...list].sort(compareTasksByOrder));
      }
      const activeTop = topLevel
        .filter((t) => !t.completed)
        .sort(compareTasksByOrder);
      const thisWeek = activeTop.filter((t) => !t.scheduledForLater);
      const later = activeTop.filter((t) => !!t.scheduledForLater);
      const completedTop = topLevel
        .filter((t) => t.completed)
        .sort(compareTasksByOrder);
      return {
        thisWeekTasks: thisWeek,
        laterTasks: later,
        completedTopLevel: completedTop,
        subtasksByParent: childrenByParent,
      };
    }, [tasks]);

  const colorMeta = getProjectColorMeta(project.headerColor);

  return (
    <div className="w-full md:w-[340px] shrink-0">
      <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-visible">
        <div
          className={`flex items-center justify-between px-4 py-3 border-b border-gray-200/70 dark:border-gray-700/70 rounded-t-2xl ${collapsed ? "rounded-b-2xl md:rounded-b-none" : ""} ${colorMeta.headerClass}`}
        >
          <button
            type="button"
            className="md:hidden font-semibold text-gray-900 dark:text-white truncate flex items-center gap-2"
            onClick={() => setCollapsed((v) => !v)}
          >
            <svg
              className={`w-4 h-4 transition-transform ${collapsed ? "" : "rotate-90"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            {project.name}
          </button>
          <div className="hidden md:block font-semibold text-gray-900 dark:text-white truncate">
            {project.name}
          </div>
          <div className="relative">
            <button
              type="button"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1"
              aria-label="Project menu"
              onClick={(e) => {
                e.stopPropagation();
                setProjectMenuOpen((v) => !v);
              }}
            >
              <IconDotsVertical className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {projectMenuOpen ? (
                <motion.div className="absolute right-0 mt-1 z-30">
                  <ProjectOptionsMenu
                    project={project}
                    onDelete={(p) => {
                      setProjectMenuOpen(false);
                      onDeleteProject(p);
                    }}
                    onSetColor={(p, color) => {
                      setProjectMenuOpen(false);
                      onSetProjectColor(p, color);
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div className={`${collapsed ? "hidden md:block" : "block"}`}>
          <div className="px-2 py-2">
            <div className="px-2 pb-2">
              <button
                type="button"
                className="w-full text-left text-sm text-[#2563eb] hover:text-[#1d4ed8] font-medium"
                onClick={() => {
                  setNewTitle("");
                  setNewDate("");
                  setShowInput(true);
                }}
              >
                + Add a task
              </button>
            </div>

            <AddTaskModal
              open={showInput}
              projectName={project.name}
              title={newTitle}
              setTitle={setNewTitle}
              date={newDate}
              setDate={setNewDate}
              onCancel={() => setShowInput(false)}
              onSubmit={() => {
                const title = newTitle.trim();
                if (!title) return;
                onAddTask(project, title, newDate || null);
                setNewTitle("");
                setNewDate("");
                setShowInput(false);
              }}
            />

            <div className="px-2 mt-1">
              <div className="flex items-center gap-2 py-1 px-1">
                <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  This Week
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700/60" />
              </div>
            </div>
            <div
              className="space-y-0.5 min-h-[28px]"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData("text/plain");
                if (!draggedId) return;
                onMoveTask?.({
                  taskId: draggedId,
                  toProjectId: project._id,
                  beforeTaskId: null,
                  scheduledForLater: false,
                });
              }}
            >
              {thisWeekTasks.length ? (
                thisWeekTasks.map((t) => (
                  <TaskRow
                    key={t._id}
                    task={t}
                    subtasks={subtasksByParent.get(String(t._id)) || []}
                    onToggle={onToggleTask}
                    onCreateSubtask={(parent, title) =>
                      onCreateSubtask(project, parent, title)
                    }
                    onDeleteTask={onDeleteTask}
                    onMoveTask={onMoveTask}
                    onSetScheduledDate={onSetScheduledDate}
                    projectId={project._id}
                    scheduledForLater={false}
                  />
                ))
              ) : (
                <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
                  No tasks this week
                </div>
              )}
            </div>

            <div className="px-2 mt-3">
              <div className="flex items-center gap-2 py-1 px-1">
                <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Later
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700/60" />
              </div>
            </div>
            <div
              className="space-y-0.5 min-h-[28px]"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData("text/plain");
                if (!draggedId) return;
                onMoveTask?.({
                  taskId: draggedId,
                  toProjectId: project._id,
                  beforeTaskId: null,
                  scheduledForLater: true,
                });
              }}
            >
              {laterTasks.length ? (
                laterTasks.map((t) => (
                  <TaskRow
                    key={t._id}
                    task={t}
                    subtasks={subtasksByParent.get(String(t._id)) || []}
                    onToggle={onToggleTask}
                    onCreateSubtask={(parent, title) =>
                      onCreateSubtask(project, parent, title)
                    }
                    onDeleteTask={onDeleteTask}
                    onMoveTask={onMoveTask}
                    onSetScheduledDate={onSetScheduledDate}
                    projectId={project._id}
                    scheduledForLater={true}
                  />
                ))
              ) : (
                <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
                  No tasks scheduled for later
                </div>
              )}
            </div>

            <div className="px-2 pb-3">
              <button
                type="button"
                className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/70 dark:hover:bg-gray-800/40 text-sm text-gray-700 dark:text-gray-200"
                onClick={() => setCompletedOpen((v) => !v)}
              >
                <span>Completed ({completedTopLevel.length})</span>
                <IconChevron open={completedOpen} className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {completedOpen ? (
                  <motion.div
                    className="mt-1"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {completedTopLevel.length ? (
                      <div className="space-y-0.5">
                        {completedTopLevel.map((t) => (
                          <TaskRow
                            key={t._id}
                            task={t}
                            subtasks={subtasksByParent.get(String(t._id)) || []}
                            onToggle={onToggleTask}
                            onCreateSubtask={(parent, title) =>
                              onCreateSubtask(project, parent, title)
                            }
                            onDeleteTask={onDeleteTask}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No completed tasks
                      </div>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="px-2 pb-3">
              <Link
                href={`/planner?tab=routines`}
                onClick={(e) => {
                  e.preventDefault();
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("planner:open-routines", {
                        detail: { projectId: project._id },
                      }),
                    );
                  }
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h7"
                  />
                </svg>
                Routine Tasks
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ╔══════════════════════════════════════════════════════╗
   ║  HABITS TAB — palettes, helpers, components          ║
   ╚══════════════════════════════════════════════════════╝ */

const COLOR_PALETTES = {
  blue: {
    label: "Blue",
    swatch: "bg-blue-500",
    shades: [
      "bg-blue-100 dark:bg-blue-900/40",
      "bg-blue-200 dark:bg-blue-800/50",
      "bg-blue-400 dark:bg-blue-600/70",
      "bg-blue-500 dark:bg-blue-500",
      "bg-blue-700 dark:bg-blue-400",
    ],
  },
  green: {
    label: "Green",
    swatch: "bg-green-500",
    shades: [
      "bg-green-100 dark:bg-green-900/40",
      "bg-green-200 dark:bg-green-800/50",
      "bg-green-400 dark:bg-green-600/70",
      "bg-green-500 dark:bg-green-500",
      "bg-green-700 dark:bg-green-400",
    ],
  },
  red: {
    label: "Red",
    swatch: "bg-red-500",
    shades: [
      "bg-red-100 dark:bg-red-900/40",
      "bg-red-200 dark:bg-red-800/50",
      "bg-red-400 dark:bg-red-600/70",
      "bg-red-500 dark:bg-red-500",
      "bg-red-700 dark:bg-red-400",
    ],
  },
  orange: {
    label: "Orange",
    swatch: "bg-orange-500",
    shades: [
      "bg-orange-100 dark:bg-orange-900/40",
      "bg-orange-200 dark:bg-orange-800/50",
      "bg-orange-400 dark:bg-orange-600/70",
      "bg-orange-500 dark:bg-orange-500",
      "bg-orange-700 dark:bg-orange-400",
    ],
  },
  purple: {
    label: "Purple",
    swatch: "bg-purple-500",
    shades: [
      "bg-purple-100 dark:bg-purple-900/40",
      "bg-purple-200 dark:bg-purple-800/50",
      "bg-purple-400 dark:bg-purple-600/70",
      "bg-purple-500 dark:bg-purple-500",
      "bg-purple-700 dark:bg-purple-400",
    ],
  },
  yellow: {
    label: "Yellow",
    swatch: "bg-yellow-500",
    shades: [
      "bg-yellow-100 dark:bg-yellow-900/40",
      "bg-yellow-200 dark:bg-yellow-700/50",
      "bg-yellow-400 dark:bg-yellow-600/70",
      "bg-yellow-500 dark:bg-yellow-500",
      "bg-yellow-600 dark:bg-yellow-400",
    ],
  },
};

function getPalette(color) {
  return COLOR_PALETTES[color] || COLOR_PALETTES.blue;
}

function getShadeClass(color, level, maxLevel) {
  if (!level) return "bg-gray-100 dark:bg-gray-800/60";
  const palette = getPalette(color);
  const idx = Math.min(
    Math.round((level / maxLevel) * (palette.shades.length - 1)),
    palette.shades.length - 1,
  );
  return palette.shades[idx];
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getYearDays(year) {
  const days = [];
  const d = new Date(year, 0, 1);
  while (d.getFullYear() === year) {
    days.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getMonthLabels(year) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1);
    months.push({
      label: d.toLocaleString("default", { month: "short" }),
      month: m,
    });
  }
  return months;
}

function getDayOfWeek(dateStr) {
  return new Date(dateStr + "T00:00:00").getDay();
}

function YearHeatmap({ year, habit, entriesByDate, onDayClick, selectedDate }) {
  const days = useMemo(() => getYearDays(year), [year]);
  const monthLabels = useMemo(() => getMonthLabels(year), [year]);
  const maxLevel = useMemo(
    () => Math.max(...(habit.levels || []).map((l) => l.value), 1),
    [habit.levels],
  );

  const weeks = useMemo(() => {
    const result = [];
    let currentWeek = new Array(7).fill(null);
    for (let i = 0; i < days.length; i++) {
      const dow = getDayOfWeek(days[i]);
      if (dow === 0 && i > 0) {
        result.push(currentWeek);
        currentWeek = new Array(7).fill(null);
      }
      currentWeek[dow] = days[i];
    }
    result.push(currentWeek);
    return result;
  }, [days]);

  const monthPositions = useMemo(() => {
    const positions = [];
    let weekIdx = 0;
    for (const week of weeks) {
      for (const dateStr of week) {
        if (!dateStr) continue;
        const month = parseInt(dateStr.split("-")[1], 10) - 1;
        if (!positions[month] && positions[month] !== 0) {
          positions[month] = weekIdx;
        }
      }
      weekIdx++;
    }
    return positions;
  }, [weeks]);

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 min-w-max">
        <div className="flex ml-8">
          {monthLabels.map((m, idx) => (
            <div
              key={idx}
              className="text-[10px] text-gray-500 dark:text-gray-400 absolute"
              style={{
                position: "relative",
                left: 0,
                width:
                  idx < 11
                    ? `${((monthPositions[idx + 1] || weeks.length) - (monthPositions[idx] || 0)) * 13}px`
                    : "auto",
              }}
            >
              {m.label}
            </div>
          ))}
        </div>

        <div className="flex gap-0">
          <div className="flex flex-col gap-[2px] mr-1 pt-0">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="h-[11px] flex items-center text-[10px] text-gray-400 dark:text-gray-500 leading-none"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="flex gap-[2px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((dateStr, di) => {
                  if (!dateStr)
                    return <div key={di} className="w-[11px] h-[11px]" />;
                  const entry = entriesByDate[dateStr];
                  const level = entry?.level || 0;
                  const shadeClass = getShadeClass(
                    habit.color,
                    level,
                    maxLevel,
                  );
                  const isSelected = selectedDate === dateStr;
                  const today = formatDate(new Date());
                  const isToday = dateStr === today;
                  return (
                    <button
                      key={di}
                      type="button"
                      className={`w-[11px] h-[11px] rounded-[2px] transition-all ${shadeClass} ${
                        isSelected
                          ? "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-900"
                          : ""
                      } ${isToday && !isSelected ? "ring-1 ring-gray-400 dark:ring-gray-500" : ""} hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 dark:hover:ring-offset-gray-900`}
                      onClick={() => onDayClick(dateStr)}
                      title={`${dateStr}${level ? ` — ${habit.levels?.find((l) => l.value === level)?.label || `Level ${level}`}` : ""}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 mt-2 ml-8">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">
            Less
          </span>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-gray-100 dark:bg-gray-800/60" />
          {(habit.levels || [])
            .sort((a, b) => a.value - b.value)
            .map((l, i) => (
              <div
                key={i}
                className={`w-[11px] h-[11px] rounded-[2px] ${getShadeClass(habit.color, l.value, maxLevel)}`}
                title={l.label}
              />
            ))}
          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
            More
          </span>
        </div>
      </div>
    </div>
  );
}

function LevelPicker({ habit, date, currentLevel, onSetLevel, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const maxLevel = Math.max(...(habit.levels || []).map((l) => l.value), 1);

  return (
    <motion.div
      ref={ref}
      className="absolute z-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 min-w-[180px]"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        {date}
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            currentLevel === 0
              ? "bg-gray-100 dark:bg-gray-800 font-medium"
              : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
          }`}
          onClick={() => {
            onSetLevel(habit._id, date, 0);
            onClose();
          }}
        >
          <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-600" />
          None
        </button>
        {(habit.levels || [])
          .sort((a, b) => a.value - b.value)
          .map((l) => (
            <button
              key={l.value}
              type="button"
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                currentLevel === l.value
                  ? "bg-gray-100 dark:bg-gray-800 font-medium"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
              }`}
              onClick={() => {
                onSetLevel(habit._id, date, l.value);
                onClose();
              }}
            >
              <div
                className={`w-3 h-3 rounded-sm ${getShadeClass(habit.color, l.value, maxLevel)}`}
              />
              {l.label}
            </button>
          ))}
      </div>
    </motion.div>
  );
}

const DEFAULT_LEVELS = [
  { label: "10 min", value: 1 },
  { label: "30 min", value: 2 },
  { label: "1 hour", value: 3 },
  { label: "2 hours", value: 4 },
];

function CreateHabitForm({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [levels, setLevels] = useState(DEFAULT_LEVELS.map((l) => ({ ...l })));

  const addLevel = () => {
    if (levels.length >= 10) return;
    setLevels((prev) => [
      ...prev,
      {
        label: "",
        value: prev.length ? Math.max(...prev.map((l) => l.value)) + 1 : 1,
      },
    ]);
  };
  const removeLevel = (idx) =>
    setLevels((prev) => prev.filter((_, i) => i !== idx));
  const updateLevel = (idx, field, val) =>
    setLevels((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)),
    );

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const validLevels = levels.filter((l) => l.label.trim());
    if (!validLevels.length) return;
    onSubmit({
      name: trimmed,
      color,
      levels: validLevels.map((l, i) => ({
        label: l.label.trim(),
        value: l.value || i + 1,
      })),
    });
  };

  return (
    <motion.div
      className="mt-3 bg-white/90 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Habit name (e.g. Running)"
          className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            Color
          </div>
          <div className="flex gap-2">
            {Object.entries(COLOR_PALETTES).map(([key, pal]) => (
              <button
                key={key}
                type="button"
                className={`w-6 h-6 rounded-full ${pal.swatch} transition-transform ${
                  color === key
                    ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900 scale-110"
                    : "hover:scale-110"
                }`}
                onClick={() => setColor(key)}
                aria-label={pal.label}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            Intensity Levels
          </div>
          <div className="space-y-1.5">
            {levels.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-sm shrink-0 ${getShadeClass(color, l.value, Math.max(...levels.map((x) => x.value), 1))}`}
                />
                <input
                  value={l.label}
                  onChange={(e) => updateLevel(i, "label", e.target.value)}
                  placeholder={`Level ${i + 1} label`}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs outline-none"
                />
                {levels.length > 1 ? (
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-500 p-0.5"
                    onClick={() => removeLevel(i)}
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {levels.length < 10 ? (
            <button
              type="button"
              className="mt-1.5 text-xs text-blue-500 hover:text-blue-600"
              onClick={addLevel}
            >
              + Add level
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium"
            onClick={handleSubmit}
          >
            Create
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function EditHabitModal({ habit, onSave, onCancel }) {
  const [name, setName] = useState(habit.name);
  const [color, setColor] = useState(habit.color || "blue");
  const [inverted, setInverted] = useState(habit.inverted || false);
  const [levels, setLevels] = useState(
    (habit.levels || []).map((l) => ({ label: l.label, value: l.value })),
  );

  const addLevel = () => {
    if (levels.length >= 10) return;
    setLevels((prev) => [
      ...prev,
      {
        label: "",
        value: prev.length ? Math.max(...prev.map((l) => l.value)) + 1 : 1,
      },
    ]);
  };
  const removeLevel = (idx) =>
    setLevels((prev) => prev.filter((_, i) => i !== idx));
  const updateLevel = (idx, field, val) =>
    setLevels((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)),
    );

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const validLevels = levels.filter((l) => l.label.trim());
    if (!validLevels.length) return;
    onSave({
      name: trimmed,
      color,
      inverted,
      levels: validLevels.map((l, i) => ({
        label: l.label.trim(),
        value: l.value || i + 1,
      })),
    });
  };

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-[90vw] max-w-md max-h-[85vh] overflow-y-auto"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Edit Habit
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
              Color
            </label>
            <div className="flex gap-2">
              {Object.entries(COLOR_PALETTES).map(([key, pal]) => (
                <button
                  key={key}
                  type="button"
                  className={`w-6 h-6 rounded-full ${pal.swatch} transition-transform ${
                    color === key
                      ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900 scale-110"
                      : "hover:scale-110"
                  }`}
                  onClick={() => setColor(key)}
                  aria-label={pal.label}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Inverted habit
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Auto-marked daily. Remove if you didn&apos;t do it.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={inverted}
              onClick={() => setInverted((v) => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${inverted ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${inverted ? "translate-x-4" : ""}`}
              />
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
              Intensity Levels
            </label>
            <div className="space-y-1.5">
              {levels.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-sm shrink-0 ${getShadeClass(color, l.value, Math.max(...levels.map((x) => x.value), 1))}`}
                  />
                  <input
                    value={l.label}
                    onChange={(e) => updateLevel(i, "label", e.target.value)}
                    placeholder={`Level ${i + 1} label`}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs outline-none"
                  />
                  {levels.length > 1 ? (
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-500 p-0.5"
                      onClick={() => removeLevel(i)}
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {levels.length < 10 ? (
              <button
                type="button"
                className="mt-1.5 text-xs text-blue-500 hover:text-blue-600"
                onClick={addLevel}
              >
                + Add level
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="flex-1 px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ╔══════════════════════════════════════════════════════╗
   ║  SCHEDULE TAB — week plan forms                      ║
   ╚══════════════════════════════════════════════════════╝ */

function getNextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

function CreateWeekForm({ projects, onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [weekStart, setWeekStart] = useState(getNextMonday());
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [estimatedTime, setEstimatedTime] = useState(60);

  const toggleProject = (pid) =>
    setSelectedProjects((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid],
    );

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      weekStart,
      projects: selectedProjects,
      estimatedDailyTime: estimatedTime,
    });
  };

  return (
    <motion.div
      className="mt-3 bg-white/90 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Week name (e.g. Week 3)"
          className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
            Week start (Monday)
          </label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
            Projects
          </label>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {projects.map((p) => (
              <label
                key={p._id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedProjects.includes(p._id)}
                  onChange={() => toggleProject(p._id)}
                  className="rounded"
                />
                <span>{p.name}</span>
              </label>
            ))}
            {!projects.length ? (
              <div className="text-xs text-gray-400 px-2">No projects</div>
            ) : null}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
            Estimated daily time (minutes)
          </label>
          <input
            type="number"
            value={estimatedTime}
            onChange={(e) => setEstimatedTime(Number(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
            min="0"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium"
            onClick={handleSubmit}
          >
            Create
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function EditWeekModal({ weekPlan, projects, onSave, onCancel }) {
  const [name, setName] = useState(weekPlan.name || "");
  const [weekStart, setWeekStart] = useState(weekPlan.weekStart || "");
  const [selectedProjects, setSelectedProjects] = useState(
    (weekPlan.projects || []).map(String),
  );
  const [estimatedTime, setEstimatedTime] = useState(
    weekPlan.estimatedDailyTime || 60,
  );

  const toggleProject = (pid) =>
    setSelectedProjects((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid],
    );

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      name: trimmed,
      weekStart,
      projects: selectedProjects,
      estimatedDailyTime: estimatedTime,
    });
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Edit Week
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Week name"
              className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Week start (Monday)
            </label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Projects
            </label>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {projects.map((p) => (
                <label
                  key={p._id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjects.includes(String(p._id))}
                    onChange={() => toggleProject(String(p._id))}
                    className="rounded"
                  />
                  <span>{p.name}</span>
                </label>
              ))}
              {!projects.length ? (
                <div className="text-xs text-gray-400 px-2">No projects</div>
              ) : null}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Estimated daily time (minutes)
            </label>
            <input
              type="number"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
              min="0"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="flex-1 px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium"
              onClick={handleSubmit}
            >
              Save
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ╔══════════════════════════════════════════════════════╗
   ║  Tab pills                                           ║
   ╚══════════════════════════════════════════════════════╝ */

const TABS = [
  { key: "tasks", label: "Tasks" },
  { key: "routines", label: "Routines" },
  { key: "habits", label: "Habits" },
  { key: "schedule", label: "Schedule" },
];

function PlannerTabs({ active, onChange }) {
  return (
    <div className="px-4 pt-4 pb-3 flex justify-center">
      <div className="inline-flex gap-1 p-1 rounded-xl bg-white/60 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50/80 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-800/50"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ╔══════════════════════════════════════════════════════╗
   ║  Page (inner — uses useSearchParams)                 ║
   ╚══════════════════════════════════════════════════════╝ */

function PlannerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = TABS.some((t) => t.key === tabParam) ? tabParam : "tasks";

  const setTab = useCallback(
    (key) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", key);
      router.replace(`/planner?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [user, setUser] = useState(null);
  const mountedRef = useRef(true);

  // ── shared: projects (used by tasks + schedule) ──────
  const [projects, setProjects] = useState([]);

  // ── tasks state ───────────────────────────────────────
  const [tasks, setTasks] = useState([]);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [sidebarMenuProjectId, setSidebarMenuProjectId] = useState(null);

  // ── habits state ──────────────────────────────────────
  const [habits, setHabits] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [creatingHabit, setCreatingHabit] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingHabit, setEditingHabit] = useState(null);

  // ── schedule state ────────────────────────────────────
  const [weekPlans, setWeekPlans] = useState([]);
  const [selectedWeekPlanId, setSelectedWeekPlanId] = useState(null);
  const [routineTasksByProject, setRoutineTasksByProject] = useState({});
  const [columnsByProject, setColumnsByProject] = useState({});
  const [creatingWeek, setCreatingWeek] = useState(false);
  const [editingWeekPlan, setEditingWeekPlan] = useState(null);

  // ── routines tab state ────────────────────────────────
  const [selectedRoutineProjectId, setSelectedRoutineProjectId] =
    useState(null);

  // ── refs ──────────────────────────────────────────────
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // ── auth bootstrap ────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("accessToken");
    if (token && token.split(".").length === 3) {
      try {
        setUser(jwtDecode(token));
      } catch (error) {
        console.error("Error decoding token:", error);
        localStorage.removeItem("accessToken");
      }
    }
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
    setUser(null);
  }, []);

  /* ── data loaders ──────────────────────────────────── */

  const refreshProjects = useCallback(async () => {
    try {
      const data = await apiJson("/api/projects");
      if (mountedRef.current) setProjects(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshTasks = useCallback(async () => {
    try {
      const data = await apiJson("/api/tasks");
      if (mountedRef.current) setTasks(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshHabits = useCallback(async () => {
    try {
      const data = await apiJson("/api/habits");
      if (mountedRef.current) setHabits(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshEntries = useCallback(async () => {
    if (!selectedHabitId) {
      setEntries([]);
      return;
    }
    try {
      const data = await apiJson(
        `/api/habits/entries?habitId=${selectedHabitId}&year=${year}`,
      );
      if (mountedRef.current) setEntries(data);
    } catch (e) {
      console.error(e);
    }
  }, [selectedHabitId, year]);

  const refreshWeekPlans = useCallback(async () => {
    try {
      const data = await apiJson("/api/week-plans");
      if (mountedRef.current) setWeekPlans(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // initial load — fetch everything at mount
  useEffect(() => {
    mountedRef.current = true;
    refreshProjects();
    refreshTasks();
    refreshHabits();
    refreshWeekPlans();
    return () => {
      mountedRef.current = false;
    };
  }, [refreshProjects, refreshTasks, refreshHabits, refreshWeekPlans]);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  // Auto-select first habit (desktop only)
  useEffect(() => {
    if (!selectedHabitId && habits.length) {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      if (isDesktop) setSelectedHabitId(habits[0]._id);
    }
  }, [habits, selectedHabitId]);

  // Auto-select first week plan (desktop only)
  useEffect(() => {
    if (!selectedWeekPlanId && weekPlans.length) {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      if (isDesktop) setSelectedWeekPlanId(weekPlans[0]._id);
    }
  }, [weekPlans, selectedWeekPlanId]);

  // Auto-select first project in routines tab (desktop only)
  useEffect(() => {
    if (!selectedRoutineProjectId && projects.length) {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      if (isDesktop) setSelectedRoutineProjectId(projects[0]._id);
    }
  }, [projects, selectedRoutineProjectId]);

  // Listen for "open routines" requests from the Tasks tab
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e) => {
      const pid = e?.detail?.projectId;
      if (pid) setSelectedRoutineProjectId(pid);
      setTab("routines");
    };
    window.addEventListener("planner:open-routines", handler);
    return () =>
      window.removeEventListener("planner:open-routines", handler);
  }, [setTab]);

  const selectedWeekPlan = weekPlans.find((w) => w._id === selectedWeekPlanId);

  // Fetch routine tasks for linked projects when week plan changes
  useEffect(() => {
    if (!selectedWeekPlan?.projects?.length) {
      setRoutineTasksByProject({});
      setColumnsByProject({});
      return;
    }
    const fetchRoutineTasks = async () => {
      const taskResults = {};
      const colResults = {};
      await Promise.all(
        selectedWeekPlan.projects.map(async (pid) => {
          try {
            const [t, c] = await Promise.all([
              apiJson(`/api/routine-tasks?projectId=${pid}`),
              apiJson(`/api/routine-tasks/columns?projectId=${pid}`),
            ]);
            taskResults[pid] = t;
            colResults[pid] = c;
          } catch (e) {
            console.error(e);
          }
        }),
      );
      if (mountedRef.current) {
        setRoutineTasksByProject(taskResults);
        setColumnsByProject(colResults);
      }
    };
    fetchRoutineTasks();
  }, [selectedWeekPlan?.projects?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const allRoutineTasks = useMemo(
    () => Object.values(routineTasksByProject).flat(),
    [routineTasksByProject],
  );
  const allColumns = useMemo(
    () => Object.values(columnsByProject).flat(),
    [columnsByProject],
  );

  // Sidebar project menu close
  useEffect(() => {
    if (!sidebarMenuProjectId) return;
    const closeMenu = () => setSidebarMenuProjectId(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [sidebarMenuProjectId]);

  /* ── tasks callbacks ───────────────────────────────── */

  const tasksByProject = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      const pid = String(t.project);
      const list = map.get(pid) || [];
      list.push(t);
      map.set(pid, list);
    }
    return map;
  }, [tasks]);

  const createProject = useCallback(async (name) => {
    try {
      const created = await apiJson("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (mountedRef.current) setProjects((prev) => [...prev, created]);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const addTask = useCallback(async (project, title, scheduledDate) => {
    const normalized =
      scheduledDate && scheduledDate.length ? scheduledDate : null;
    const scheduledForLater =
      normalized && !isInCurrentWeek(normalized) ? true : undefined;
    try {
      const created = await apiJson("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: project._id,
          title,
          ...(normalized ? { scheduledDate: normalized } : {}),
          ...(scheduledForLater ? { scheduledForLater: true } : {}),
        }),
      });
      if (mountedRef.current) setTasks((prev) => [...prev, created]);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const createSubtask = useCallback(async (project, parentTask, title) => {
    try {
      const created = await apiJson("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: project._id,
          title,
          parentTaskId: parentTask._id,
        }),
      });
      if (mountedRef.current) setTasks((prev) => [...prev, created]);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleTask = useCallback(async (task) => {
    try {
      const updated = await apiJson("/api/tasks", {
        method: "PATCH",
        body: JSON.stringify({ id: task._id, completed: !task.completed }),
      });
      if (mountedRef.current)
        setTasks((prev) =>
          prev.map((t) => (t._id === updated._id ? updated : t)),
        );
    } catch (e) {
      console.error(e);
    }
  }, []);

  const setTaskScheduledDate = useCallback(async (task, dateString) => {
    // dateString: "YYYY-MM-DD" or null/"" to clear
    const normalized = dateString && dateString.length ? dateString : null;
    try {
      const updated = await apiJson("/api/tasks", {
        method: "PATCH",
        body: JSON.stringify({ id: task._id, scheduledDate: normalized }),
      });
      if (mountedRef.current) {
        setTasks((prev) =>
          prev.map((t) => (t._id === updated._id ? updated : t)),
        );
      }
      // Auto-bucket: if a date was set and it falls OUTSIDE the current week,
      // promote the task to "Later". Dates inside the current week (or clearing
      // the date) never touch scheduledForLater — manual placement is preserved.
      if (
        normalized &&
        !isInCurrentWeek(normalized) &&
        !task.scheduledForLater
      ) {
        try {
          await apiJson("/api/tasks/reorder", {
            method: "PATCH",
            body: JSON.stringify({
              updates: [
                {
                  id: task._id,
                  order: Number.isFinite(task.order) ? task.order : 0,
                  scheduledForLater: true,
                },
              ],
            }),
          });
          if (mountedRef.current) {
            setTasks((prev) =>
              prev.map((t) =>
                t._id === task._id ? { ...t, scheduledForLater: true } : t,
              ),
            );
          }
        } catch (err) {
          console.error(err);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteProject = useCallback(async (project) => {
    const ok = window.confirm(`Delete project "${project.name}"?`);
    if (!ok) return;
    try {
      await apiJson("/api/projects", {
        method: "DELETE",
        body: JSON.stringify({ id: project._id }),
      });
      if (mountedRef.current) {
        setProjects((prev) => prev.filter((p) => p._id !== project._id));
        setTasks((prev) =>
          prev.filter((t) => String(t.project) !== String(project._id)),
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteTask = useCallback(
    async (task) => {
      const label = task?.title ? `"${task.title}"` : "this task";
      const ok = window.confirm(`Delete ${label}? This also deletes subtasks.`);
      if (!ok) return;
      try {
        await apiJson("/api/tasks", {
          method: "DELETE",
          body: JSON.stringify({ id: task._id }),
        });
        if (mountedRef.current) {
          const rootId = String(task._id);
          setTasks((prev) => {
            const byParent = new Map();
            for (const t of prev) {
              const pid = t.parentTask ? String(t.parentTask) : null;
              if (!pid) continue;
              const list = byParent.get(pid) || [];
              list.push(t);
              byParent.set(pid, list);
            }
            const toDelete = new Set([rootId]);
            const queue = [rootId];
            while (queue.length) {
              const cur = queue.shift();
              const kids = byParent.get(cur) || [];
              for (const k of kids) {
                const kidId = String(k._id);
                if (toDelete.has(kidId)) continue;
                toDelete.add(kidId);
                queue.push(kidId);
              }
              if (toDelete.size > 10000) break;
            }
            return prev.filter((t) => !toDelete.has(String(t._id)));
          });
        }
      } catch (e) {
        console.error(e);
        refreshTasks();
      }
    },
    [refreshTasks],
  );

  const setProjectColor = useCallback(async (project, headerColor) => {
    if (mountedRef.current) {
      setProjects((prev) =>
        prev.map((p) =>
          String(p._id) === String(project._id) ? { ...p, headerColor } : p,
        ),
      );
    }
    try {
      const updated = await apiJson("/api/projects", {
        method: "PATCH",
        body: JSON.stringify({ id: project._id, headerColor }),
      });
      if (mountedRef.current)
        setProjects((prev) =>
          prev.map((p) =>
            String(p._id) === String(updated._id) ? updated : p,
          ),
        );
    } catch (e) {
      console.error(e);
    }
  }, []);

  const moveTask = useCallback(
    async ({ taskId, toProjectId, beforeTaskId, scheduledForLater }) => {
      const current = tasksRef.current;
      const dragged = current.find((t) => String(t._id) === String(taskId));
      if (!dragged) return;
      if (dragged.parentTask) return;
      if (dragged.completed) return;

      const fromProjectId = String(dragged.project);
      const targetProjectId = String(toProjectId);
      const sourceIsLater = !!dragged.scheduledForLater;
      const targetIsLater = !!scheduledForLater;

      const isInSection = (pid, later) => (t) =>
        !t.completed &&
        !t.parentTask &&
        String(t.project) === String(pid) &&
        !!t.scheduledForLater === later;
      const sortList = (list) => [...list].sort(compareTasksByOrder);

      const sameList =
        fromProjectId === targetProjectId && sourceIsLater === targetIsLater;

      const baseFrom = sortList(
        current
          .filter(isInSection(fromProjectId, sourceIsLater))
          .filter((t) => String(t._id) !== String(taskId)),
      );
      const baseTo = sameList
        ? baseFrom
        : sortList(
            current
              .filter(isInSection(targetProjectId, targetIsLater))
              .filter((t) => String(t._id) !== String(taskId)),
          );

      let insertIndex = baseTo.length;
      if (beforeTaskId) {
        const idx = baseTo.findIndex(
          (t) => String(t._id) === String(beforeTaskId),
        );
        if (idx >= 0) insertIndex = idx;
      }

      const moved = {
        ...dragged,
        project: targetProjectId,
        scheduledForLater: targetIsLater,
      };
      const nextTo = [...baseTo];
      nextTo.splice(insertIndex, 0, moved);

      const updates = [];
      const nextById = new Map();
      const applyOrders = (list, pid) => {
        list.forEach((t, idx) => {
          const id = String(t._id);
          const isMoved = id === String(taskId);
          const update = {
            id,
            order: idx,
            ...(isMoved || String(t.project) !== String(pid)
              ? { projectId: String(pid) }
              : {}),
            ...(isMoved ? { scheduledForLater: targetIsLater } : {}),
          };
          updates.push(update);
          nextById.set(id, update);
        });
      };

      if (sameList) {
        applyOrders(nextTo, targetProjectId);
      } else {
        applyOrders(baseFrom, fromProjectId);
        applyOrders(nextTo, targetProjectId);
      }

      const nextTasks = current.map((t) => {
        const u = nextById.get(String(t._id));
        if (!u) return t;
        const updated = { ...t, order: u.order };
        if (u.projectId) updated.project = u.projectId;
        if (typeof u.scheduledForLater === "boolean")
          updated.scheduledForLater = u.scheduledForLater;
        return updated;
      });

      if (mountedRef.current) setTasks(nextTasks);

      try {
        await apiJson("/api/tasks/reorder", {
          method: "PATCH",
          body: JSON.stringify({ updates }),
        });
      } catch (e) {
        console.error(e);
        refreshTasks();
      }
    },
    [refreshTasks],
  );

  /* ── habits callbacks ──────────────────────────────── */

  const createHabit = useCallback(async (data) => {
    try {
      const created = await apiJson("/api/habits", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (mountedRef.current) {
        setHabits((prev) => [...prev, created]);
        setSelectedHabitId(created._id);
        setCreatingHabit(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteHabit = useCallback(
    async (habit) => {
      const ok = window.confirm(`Delete habit "${habit.name}"?`);
      if (!ok) return;
      try {
        await apiJson("/api/habits", {
          method: "DELETE",
          body: JSON.stringify({ id: habit._id }),
        });
        if (mountedRef.current) {
          setHabits((prev) => prev.filter((h) => h._id !== habit._id));
          if (selectedHabitId === habit._id) setSelectedHabitId(null);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [selectedHabitId],
  );

  const updateHabit = useCallback(async (habitId, updates) => {
    try {
      const updated = await apiJson("/api/habits", {
        method: "PATCH",
        body: JSON.stringify({ id: habitId, ...updates }),
      });
      if (mountedRef.current)
        setHabits((prev) => prev.map((h) => (h._id === habitId ? updated : h)));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const setEntryLevel = useCallback(
    async (habitId, date, level) => {
      setEntries((prev) => {
        if (level === 0) return prev.filter((e) => e.date !== date);
        const existing = prev.find((e) => e.date === date);
        if (existing)
          return prev.map((e) => (e.date === date ? { ...e, level } : e));
        return [...prev, { habit: habitId, date, level }];
      });
      try {
        await apiJson("/api/habits/entries", {
          method: "PUT",
          body: JSON.stringify({ habitId, date, level }),
        });
      } catch (e) {
        console.error(e);
        refreshEntries();
      }
    },
    [refreshEntries],
  );

  /* ── schedule callbacks ────────────────────────────── */

  const createWeekPlan = useCallback(async (data) => {
    try {
      const created = await apiJson("/api/week-plans", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (mountedRef.current) {
        setWeekPlans((prev) => [created, ...prev]);
        setSelectedWeekPlanId(created._id);
        setCreatingWeek(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteWeekPlan = useCallback(
    async (plan) => {
      const ok = window.confirm(`Delete week "${plan.name}"?`);
      if (!ok) return;
      try {
        await apiJson("/api/week-plans", {
          method: "DELETE",
          body: JSON.stringify({ id: plan._id }),
        });
        if (mountedRef.current) {
          setWeekPlans((prev) => prev.filter((w) => w._id !== plan._id));
          if (selectedWeekPlanId === plan._id) setSelectedWeekPlanId(null);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [selectedWeekPlanId],
  );

  const updateWeekPlan = useCallback(
    async (id, updates) => {
      setWeekPlans((prev) =>
        prev.map((wp) => (wp._id === id ? { ...wp, ...updates } : wp)),
      );
      try {
        const updated = await apiJson("/api/week-plans", {
          method: "PATCH",
          body: JSON.stringify({ id, ...updates }),
        });
        if (mountedRef.current)
          setWeekPlans((prev) =>
            prev.map((wp) => (wp._id === updated._id ? updated : wp)),
          );
      } catch (e) {
        console.error(e);
        refreshWeekPlans();
      }
    },
    [refreshWeekPlans],
  );

  const addWeekTask = useCallback(
    async (dayOfWeek, data) => {
      if (!selectedWeekPlanId) return;
      setWeekPlans((prev) =>
        prev.map((wp) => {
          if (wp._id !== selectedWeekPlanId) return wp;
          const days = wp.days.map((d) => {
            if (d.dayOfWeek !== dayOfWeek) return d;
            return {
              ...d,
              tasks: [
                ...d.tasks,
                {
                  _id: "temp_" + Date.now(),
                  taskName: data.taskName,
                  estimatedTime: data.estimatedTime || 0,
                  notes: data.notes || "",
                  completed: !!data.completed,
                  order: d.tasks.length,
                  routineTask: data.routineTaskId || null,
                  project: data.projectId || null,
                },
              ],
            };
          });
          return { ...wp, days };
        }),
      );
      try {
        const updated = await apiJson("/api/week-plans/tasks", {
          method: "POST",
          body: JSON.stringify({
            weekPlanId: selectedWeekPlanId,
            dayOfWeek,
            ...data,
          }),
        });
        if (mountedRef.current)
          setWeekPlans((prev) =>
            prev.map((wp) => (wp._id === updated._id ? updated : wp)),
          );
      } catch (e) {
        console.error(e);
        refreshWeekPlans();
      }
    },
    [selectedWeekPlanId, refreshWeekPlans],
  );

  const updateWeekTask = useCallback(
    async (dayOfWeek, taskId, updates) => {
      if (!selectedWeekPlanId) return;
      setWeekPlans((prev) =>
        prev.map((wp) => {
          if (wp._id !== selectedWeekPlanId) return wp;
          const days = wp.days.map((d) => {
            if (d.dayOfWeek !== dayOfWeek) return d;
            return {
              ...d,
              tasks: d.tasks.map((t) =>
                String(t._id) === String(taskId) ? { ...t, ...updates } : t,
              ),
            };
          });
          return { ...wp, days };
        }),
      );
      try {
        const updated = await apiJson("/api/week-plans/tasks", {
          method: "PATCH",
          body: JSON.stringify({
            weekPlanId: selectedWeekPlanId,
            dayOfWeek,
            taskId,
            ...updates,
          }),
        });
        if (mountedRef.current)
          setWeekPlans((prev) =>
            prev.map((wp) => (wp._id === updated._id ? updated : wp)),
          );
      } catch (e) {
        console.error(e);
        refreshWeekPlans();
      }
    },
    [selectedWeekPlanId, refreshWeekPlans],
  );

  const moveWeekTask = useCallback(
    async ({ taskId, fromDayOfWeek, toDayOfWeek, toProjectId }) => {
      if (!selectedWeekPlanId) return;
      if (typeof taskId !== "string" || taskId.startsWith("temp_")) return;
      // Optimistic update: pull from `fromDay`, push to `toDay` with new project
      setWeekPlans((prev) =>
        prev.map((wp) => {
          if (wp._id !== selectedWeekPlanId) return wp;
          let movedTask = null;
          const days = wp.days.map((d) => {
            if (d.dayOfWeek !== fromDayOfWeek) return d;
            const remaining = [];
            for (const t of d.tasks) {
              if (String(t._id) === String(taskId)) {
                movedTask = t;
              } else {
                remaining.push(t);
              }
            }
            return { ...d, tasks: remaining };
          });
          if (!movedTask) return wp;
          const nextDays = days.map((d) => {
            if (d.dayOfWeek !== toDayOfWeek) return d;
            return {
              ...d,
              tasks: [
                ...d.tasks,
                {
                  ...movedTask,
                  project:
                    toProjectId !== undefined
                      ? toProjectId
                      : movedTask.project || null,
                  order: d.tasks.length,
                },
              ],
            };
          });
          return { ...wp, days: nextDays };
        }),
      );
      try {
        const updated = await apiJson("/api/week-plans/tasks/move", {
          method: "POST",
          body: JSON.stringify({
            weekPlanId: selectedWeekPlanId,
            fromDayOfWeek,
            toDayOfWeek,
            taskId,
            toProjectId: toProjectId ?? null,
          }),
        });
        if (mountedRef.current)
          setWeekPlans((prev) =>
            prev.map((wp) => (wp._id === updated._id ? updated : wp)),
          );
      } catch (e) {
        console.error(e);
        refreshWeekPlans();
      }
    },
    [selectedWeekPlanId, refreshWeekPlans],
  );

  const toggleWeekTask = useCallback(
    async (dayOfWeek, taskId, completed) => {
      if (!selectedWeekPlanId) return;
      setWeekPlans((prev) =>
        prev.map((wp) => {
          if (wp._id !== selectedWeekPlanId) return wp;
          const days = wp.days.map((d) => {
            if (d.dayOfWeek !== dayOfWeek) return d;
            return {
              ...d,
              tasks: d.tasks.map((t) =>
                String(t._id) === String(taskId) ? { ...t, completed } : t,
              ),
            };
          });
          return { ...wp, days };
        }),
      );
      try {
        await apiJson("/api/week-plans/tasks", {
          method: "PATCH",
          body: JSON.stringify({
            weekPlanId: selectedWeekPlanId,
            dayOfWeek,
            taskId,
            completed,
          }),
        });
      } catch (e) {
        console.error(e);
        refreshWeekPlans();
      }
    },
    [selectedWeekPlanId, refreshWeekPlans],
  );

  const deleteWeekTask = useCallback(
    async (dayOfWeek, taskId) => {
      if (!selectedWeekPlanId) return;
      setWeekPlans((prev) =>
        prev.map((wp) => {
          if (wp._id !== selectedWeekPlanId) return wp;
          const days = wp.days.map((d) => {
            if (d.dayOfWeek !== dayOfWeek) return d;
            return {
              ...d,
              tasks: d.tasks.filter((t) => String(t._id) !== String(taskId)),
            };
          });
          return { ...wp, days };
        }),
      );
      try {
        await apiJson("/api/week-plans/tasks", {
          method: "DELETE",
          body: JSON.stringify({
            weekPlanId: selectedWeekPlanId,
            dayOfWeek,
            taskId,
          }),
        });
      } catch (e) {
        console.error(e);
        refreshWeekPlans();
      }
    },
    [selectedWeekPlanId, refreshWeekPlans],
  );

  /* ── derived ───────────────────────────────────────── */

  const selectedHabit = habits.find((h) => h._id === selectedHabitId);
  const entriesByDate = useMemo(() => {
    const map = {};
    for (const e of entries) map[e.date] = e;
    return map;
  }, [entries]);
  const totalTracked = entries.filter((e) => e.level > 0).length;

  /* ╔════════════════════════════════════════════════════╗
     ║  Sidebar renderers (per tab)                       ║
     ╚════════════════════════════════════════════════════╝ */

  const renderTasksSidebar = () => (
    <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-3">
      <button
        type="button"
        className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/70 dark:hover:bg-gray-800/40"
        onClick={() => setProjectsOpen((v) => (creatingProject ? true : !v))}
      >
        <span className="font-semibold">Projects</span>
        <IconChevron open={projectsOpen} className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {projectsOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="mt-2 space-y-1">
              {projects.map((p) => {
                const colorMeta = getProjectColorMeta(p.headerColor);
                return (
                <div
                  key={p._id}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-800/40"
                >
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${colorMeta.swatchClass}`}
                  />
                  <div className="flex-1 min-w-0 truncate">{p.name}</div>
                  <div className="relative">
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1"
                      aria-label="Project menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSidebarMenuProjectId((cur) =>
                          cur === p._id ? null : p._id,
                        );
                      }}
                    >
                      <IconDotsVertical className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {sidebarMenuProjectId === p._id ? (
                        <motion.div
                          className="absolute right-0 mt-1 z-30"
                          onClick={(e) => e.stopPropagation()}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                        >
                          <ProjectOptionsMenu
                            project={p}
                            onDelete={(proj) => {
                              setSidebarMenuProjectId(null);
                              deleteProject(proj);
                            }}
                            onSetColor={(proj, color) => {
                              setSidebarMenuProjectId(null);
                              setProjectColor(proj, color);
                            }}
                          />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              );
              })}
              {!projects.length ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No projects yet
                </div>
              ) : null}
            </div>

            <div className="mt-3">
              {!creatingProject ? (
                <button
                  type="button"
                  className="w-full px-3 py-2 rounded-lg bg-white/70 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-white dark:hover:bg-gray-800/50"
                  onClick={() => setCreatingProject(true)}
                >
                  + Create new project
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Project name"
                    className="flex-1 px-3 py-2 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const name = projectName.trim();
                        if (!name) return;
                        createProject(name).catch((err) => console.error(err));
                        setProjectName("");
                        setCreatingProject(false);
                      }
                      if (e.key === "Escape") setCreatingProject(false);
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="w-full px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm"
                    onClick={() => {
                      const name = projectName.trim();
                      if (!name) return;
                      createProject(name).catch((err) => console.error(err));
                      setProjectName("");
                      setCreatingProject(false);
                    }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  const renderHabitsSidebar = () => (
    <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-3 overflow-hidden">
      <div className="px-2 py-2 font-semibold text-gray-900 dark:text-white">
        Habits
      </div>
      <div className="space-y-1 mt-1">
        {habits.map((h) => {
          const palette = getPalette(h.color);
          const isActive = selectedHabitId === h._id;
          return (
            <div
              key={h._id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                  : "text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-800/40"
              }`}
              onClick={() => {
                setSelectedHabitId(h._id);
                setSelectedDate(null);
              }}
            >
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${palette.swatch}`}
              />
              <div className="flex-1 min-w-0 truncate">{h.name}</div>
              <button
                type="button"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteHabit(h);
                }}
                aria-label="Delete habit"
              >
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        {!habits.length && !creatingHabit ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            No habits yet
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {creatingHabit ? (
          <CreateHabitForm
            onSubmit={createHabit}
            onCancel={() => setCreatingHabit(false)}
          />
        ) : null}
      </AnimatePresence>

      {!creatingHabit ? (
        <button
          type="button"
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/70 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-white dark:hover:bg-gray-800/50 transition-colors"
          onClick={() => setCreatingHabit(true)}
        >
          <IconPlus className="w-4 h-4" />
          Create habit
        </button>
      ) : null}
    </div>
  );

  /* ── Routines tab renderers ────────────────────────── */

  const renderRoutinesSidebar = () => (
    <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-3 overflow-hidden">
      <div className="px-2 py-2 font-semibold text-gray-900 dark:text-white">
        Projects
      </div>
      <div className="space-y-1 mt-1">
        {projects.map((p) => {
          const isActive = selectedRoutineProjectId === p._id;
          const colorMeta = getProjectColorMeta(p.headerColor);
          return (
            <div
              key={p._id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                  : "text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-800/40"
              }`}
              onClick={() => setSelectedRoutineProjectId(p._id)}
            >
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${colorMeta.swatchClass}`}
              />
              <div className="flex-1 min-w-0 truncate">{p.name}</div>
            </div>
          );
        })}
        {!projects.length ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            No projects yet
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderRoutinesMain = () => {
    const proj = projects.find((p) => p._id === selectedRoutineProjectId);
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        {/* Mobile back button */}
        {selectedRoutineProjectId ? (
          <button
            type="button"
            className="md:hidden mb-3 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400"
            onClick={() => setSelectedRoutineProjectId(null)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to projects
          </button>
        ) : null}

        {/* Mobile project list when none selected */}
        {!selectedRoutineProjectId ? (
          <div className="md:hidden space-y-1">
            {projects.map((p) => {
              const colorMeta = getProjectColorMeta(p.headerColor);
              return (
              <button
                key={p._id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left bg-white/70 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800/50 transition-colors"
                onClick={() => setSelectedRoutineProjectId(p._id)}
              >
                <div
                  className={`w-3 h-3 rounded-full shrink-0 ${colorMeta.swatchClass}`}
                />
                <span className="truncate">{p.name}</span>
              </button>
              );
            })}
            {!projects.length ? (
              <div className="text-gray-600 dark:text-gray-300 px-2 py-4">
                Create a project in the Tasks tab first.
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedRoutineProjectId ? (
          <>
            {proj ? (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {proj.name}
              </h2>
            ) : null}
            <RoutineTasksView
              key={selectedRoutineProjectId}
              projectId={selectedRoutineProjectId}
            />
          </>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p className="text-lg">
              {projects.length
                ? "Select a project"
                : "Create a project in the Tasks tab to get started"}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderScheduleSidebar = () => (
    <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-3 overflow-hidden">
      <div className="px-2 py-2 font-semibold text-gray-900 dark:text-white">
        Weekly Routines
      </div>
      <div className="space-y-1 mt-1">
        {weekPlans.map((wp) => {
          const isActive = selectedWeekPlanId === wp._id;
          const start = new Date(wp.weekStart + "T00:00:00");
          const end = new Date(start);
          end.setDate(end.getDate() + 6);
          const fmt = (d) =>
            `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
          return (
            <div
              key={wp._id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                  : "text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-800/40"
              }`}
              onClick={() => setSelectedWeekPlanId(wp._id)}
            >
              <div className="w-3 h-3 rounded-full shrink-0 bg-blue-500" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{wp.name}</div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500">
                  {fmt(start)} – {fmt(end)}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteWeekPlan(wp);
                }}
                aria-label="Delete week plan"
              >
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        {!weekPlans.length && !creatingWeek ? (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            No weekly routines yet
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {creatingWeek ? (
          <CreateWeekForm
            projects={projects}
            onSubmit={createWeekPlan}
            onCancel={() => setCreatingWeek(false)}
          />
        ) : null}
      </AnimatePresence>

      {!creatingWeek ? (
        <button
          type="button"
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/70 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-white dark:hover:bg-gray-800/50 transition-colors"
          onClick={() => setCreatingWeek(true)}
        >
          <IconPlus className="w-4 h-4" />
          Add Week
        </button>
      ) : null}
    </div>
  );

  /* ╔════════════════════════════════════════════════════╗
     ║  Main renderers (per tab)                          ║
     ╚════════════════════════════════════════════════════╝ */

  const renderTasksMain = () => (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-start gap-4 p-4 md:pr-8">
        {projects.map((p) => (
          <ProjectColumn
            key={p._id}
            project={p}
            tasks={tasksByProject.get(String(p._id)) || []}
            onAddTask={addTask}
            onToggleTask={toggleTask}
            onCreateSubtask={createSubtask}
            onDeleteTask={deleteTask}
            onDeleteProject={deleteProject}
            onSetProjectColor={setProjectColor}
            onMoveTask={moveTask}
            onSetScheduledDate={setTaskScheduledDate}
          />
        ))}

        {!projects.length ? (
          <div className="text-gray-600 dark:text-gray-300 px-4 py-4">
            Create a project to start adding tasks.
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderHabitsMain = () => (
    <div className="h-full overflow-auto p-4 md:p-6">
      {/* Mobile: list when none selected */}
      {!selectedHabitId ? (
        <div className="md:hidden">
          <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-3">
            <div className="px-2 py-2 font-semibold text-gray-900 dark:text-white">
              Habits
            </div>
            <div className="space-y-1 mt-1">
              {habits.map((h) => {
                const palette = getPalette(h.color);
                return (
                  <div
                    key={h._id}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-800/40"
                    onClick={() => {
                      setSelectedHabitId(h._id);
                      setSelectedDate(null);
                    }}
                  >
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${palette.swatch}`}
                    />
                    <div className="flex-1 min-w-0 truncate">{h.name}</div>
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                );
              })}
              {!habits.length && !creatingHabit ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No habits yet
                </div>
              ) : null}
            </div>
            {!creatingHabit ? (
              <button
                type="button"
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/70 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-white dark:hover:bg-gray-800/50 transition-colors"
                onClick={() => setCreatingHabit(true)}
              >
                <IconPlus className="w-4 h-4" />
                Create habit
              </button>
            ) : null}
            <AnimatePresence>
              {creatingHabit ? (
                <CreateHabitForm
                  onSubmit={createHabit}
                  onCancel={() => setCreatingHabit(false)}
                />
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      ) : null}

      {selectedHabit ? (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => {
                  setSelectedHabitId(null);
                  setSelectedDate(null);
                }}
                aria-label="Back to list"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedHabit.name}
                  </h2>
                  <button
                    type="button"
                    className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    onClick={() => setEditingHabit(selectedHabit)}
                    aria-label="Edit habit"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                  {selectedHabit.inverted ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                      inverted
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {totalTracked} day{totalTracked !== 1 ? "s" : ""} tracked in{" "}
                  {year}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => setYear((y) => y - 1)}
              >
                &larr;
              </button>
              <span className="text-sm font-semibold min-w-[3rem] text-center">
                {year}
              </span>
              <button
                type="button"
                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => setYear((y) => y + 1)}
              >
                &rarr;
              </button>
            </div>
          </div>

          <div className="relative">
            <YearHeatmap
              year={year}
              habit={selectedHabit}
              entriesByDate={entriesByDate}
              onDayClick={(date) => {
                const dayDate = new Date(date + "T00:00:00");
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.floor((today - dayDate) / 86400000);
                if (diffDays > 7) return;
                setSelectedDate((prev) => (prev === date ? null : date));
              }}
              selectedDate={selectedDate}
            />

            <div className="flex items-center gap-1.5 mt-2">
              <svg
                className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path
                  strokeLinecap="round"
                  strokeWidth="2"
                  d="M12 16v-4M12 8h.01"
                />
              </svg>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                Only the last 7 days can be edited
              </span>
            </div>

            <AnimatePresence>
              {selectedDate ? (
                <div className="mt-2">
                  <LevelPicker
                    habit={selectedHabit}
                    date={selectedDate}
                    currentLevel={entriesByDate[selectedDate]?.level || 0}
                    onSetLevel={setEntryLevel}
                    onClose={() => setSelectedDate(null)}
                  />
                </div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Intensity Levels
            </h3>
            <div className="flex flex-wrap gap-3">
              {(selectedHabit.levels || [])
                .sort((a, b) => a.value - b.value)
                .map((l) => {
                  const maxLvl = Math.max(
                    ...(selectedHabit.levels || []).map((x) => x.value),
                    1,
                  );
                  return (
                    <div key={l.value} className="flex items-center gap-1.5">
                      <div
                        className={`w-4 h-4 rounded-sm ${getShadeClass(selectedHabit.color, l.value, maxLvl)}`}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {l.label}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <p className="text-lg">
            {habits.length
              ? "Select a habit to view its tracker"
              : "Create a habit to get started"}
          </p>
        </div>
      )}
    </div>
  );

  const renderScheduleMain = () => (
    <div className="h-full overflow-auto p-4 md:p-6">
      {/* Mobile: list when none selected */}
      {!selectedWeekPlanId ? (
        <div className="md:hidden">
          <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-3">
            <div className="px-2 py-2 font-semibold text-gray-900 dark:text-white">
              Weekly Routines
            </div>
            <div className="space-y-1 mt-1">
              {weekPlans.map((wp) => {
                const start = new Date(wp.weekStart + "T00:00:00");
                const end = new Date(start);
                end.setDate(end.getDate() + 6);
                const fmt = (d) =>
                  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
                return (
                  <div
                    key={wp._id}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-gray-800/40"
                    onClick={() => setSelectedWeekPlanId(wp._id)}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0 bg-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{wp.name}</div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500">
                        {fmt(start)} – {fmt(end)}
                      </div>
                    </div>
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                );
              })}
              {!weekPlans.length && !creatingWeek ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No weekly routines yet
                </div>
              ) : null}
            </div>
            {!creatingWeek ? (
              <button
                type="button"
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/70 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-white dark:hover:bg-gray-800/50 transition-colors"
                onClick={() => setCreatingWeek(true)}
              >
                <IconPlus className="w-4 h-4" />
                Add Week
              </button>
            ) : null}
            <AnimatePresence>
              {creatingWeek ? (
                <CreateWeekForm
                  projects={projects}
                  onSubmit={createWeekPlan}
                  onCancel={() => setCreatingWeek(false)}
                />
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      ) : null}

      {selectedWeekPlan ? (
        <div>
          <button
            type="button"
            className="md:hidden flex items-center gap-1 mb-4 p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-600 dark:text-gray-300"
            onClick={() => setSelectedWeekPlanId(null)}
            aria-label="Back to list"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <WeeklyRoutine
            weekPlan={selectedWeekPlan}
            routineTasks={allRoutineTasks}
            columns={allColumns}
            projects={projects}
            tasks={tasks}
            onAddTask={addWeekTask}
            onToggleTask={toggleWeekTask}
            onDeleteTask={deleteWeekTask}
            onUpdateTask={updateWeekTask}
            onMoveTask={moveWeekTask}
            onEditWeek={(wp) => setEditingWeekPlan(wp)}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <p className="text-lg">
            {weekPlans.length
              ? "Select a weekly routine"
              : "Create a weekly routine to get started"}
          </p>
        </div>
      )}
    </div>
  );

  /* ╔════════════════════════════════════════════════════╗
     ║  Render                                            ║
     ╚════════════════════════════════════════════════════╝ */

  const sidebar =
    activeTab === "tasks"
      ? renderTasksSidebar()
      : activeTab === "routines"
        ? renderRoutinesSidebar()
        : activeTab === "habits"
          ? renderHabitsSidebar()
          : renderScheduleSidebar();

  const main =
    activeTab === "tasks"
      ? renderTasksMain()
      : activeTab === "routines"
        ? renderRoutinesMain()
        : activeTab === "habits"
          ? renderHabitsMain()
          : renderScheduleMain();

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />

      <PlannerTabs active={activeTab} onChange={setTab} />

      <div className="w-full h-[calc(100vh-9rem)] flex flex-col md:flex-row md:px-6">
        {/* Sidebar (desktop only) */}
        <div className="hidden md:block md:static md:w-[280px] md:pt-0 md:bg-transparent md:shadow-none h-full px-4 pb-6 overflow-y-auto">
          {sidebar}
        </div>

        {/* Main */}
        <div className="flex-1 h-full px-2 md:px-0 md:pr-4 pb-6 overflow-hidden min-w-0">
          <div className="h-full bg-white/40 dark:bg-gray-950/10 border border-gray-200/50 dark:border-gray-800/40 rounded-2xl overflow-hidden">
            {main}
          </div>
        </div>
      </div>

      {/* Modals — root-mounted so they survive tab switches */}
      <AnimatePresence>
        {editingWeekPlan ? (
          <EditWeekModal
            weekPlan={editingWeekPlan}
            projects={projects}
            onSave={(updates) => {
              updateWeekPlan(editingWeekPlan._id, updates);
              setEditingWeekPlan(null);
            }}
            onCancel={() => setEditingWeekPlan(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editingHabit ? (
          <EditHabitModal
            habit={editingHabit}
            onSave={(updates) => {
              updateHabit(editingHabit._id, updates);
              setEditingHabit(null);
            }}
            onCancel={() => setEditingHabit(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={<div className="w-screen min-h-screen" />}>
      <PlannerPageInner />
    </Suspense>
  );
}
