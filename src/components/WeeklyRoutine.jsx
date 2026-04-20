"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatMinutes(m) {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h && min) return `${h}h${min}m`;
  if (h) return `${h}h`;
  return `${min}m`;
}

/* ── Icons ─────────────────────────────────────────────── */

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

function IconCheck({ className = "" }) {
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

/* ── Add Task Popover ──────────────────────────────────── */

function AddTaskPopover({ routineTasks, onAdd, onClose, anchorRef }) {
  const ref = useRef(null);
  const [mode, setMode] = useState("routine"); // routine | adhoc
  const [adHocName, setAdHocName] = useState("");
  const [adHocTime, setAdHocTime] = useState("");
  const [pos] = useState(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      return { top: rect.bottom + 4, left: rect.left };
    }
    return { top: 0, left: 0 };
  });

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top: pos.top, left: pos.left }}
      className="z-[9999] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 min-w-[220px] max-h-[300px] overflow-y-auto"
    >
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === "routine"
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          onClick={() => setMode("routine")}
        >
          From Routine
        </button>
        <button
          type="button"
          className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === "adhoc"
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          onClick={() => setMode("adhoc")}
        >
          Ad-hoc
        </button>
      </div>

      {mode === "routine" ? (
        <div className="space-y-1">
          {routineTasks.length ? (
            routineTasks.map((rt) => (
              <button
                key={rt._id}
                type="button"
                className="w-full text-left px-2 py-1.5 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                onClick={() => {
                  onAdd({
                    routineTaskId: rt._id,
                    taskName: rt.title,
                    estimatedTime: rt.estimatedTime || 0,
                  });
                  onClose();
                }}
              >
                <div className="font-medium">{rt.title}</div>
                {rt.estimatedTime ? (
                  <div className="text-xs text-gray-400">
                    {formatMinutes(rt.estimatedTime)}
                  </div>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-gray-400">
              No routine tasks found
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={adHocName}
            onChange={(e) => setAdHocName(e.target.value)}
            placeholder="Task name"
            className="w-full px-2 py-1.5 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && adHocName.trim()) {
                onAdd({
                  taskName: adHocName.trim(),
                  estimatedTime: adHocTime ? Number(adHocTime) : 0,
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
            className="w-full px-2 py-1.5 rounded-lg bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-sm outline-none"
            min="0"
          />
          <button
            type="button"
            className="w-full px-2 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium"
            onClick={() => {
              if (!adHocName.trim()) return;
              onAdd({
                taskName: adHocName.trim(),
                estimatedTime: adHocTime ? Number(adHocTime) : 0,
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

/* ── Color Lines (vertical bars for task colors) ───────── */

function TaskColorLines({ manualColor, conditionalColor }) {
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

/* ── Main WeeklyRoutine Component ──────────────────────── */

export default function WeeklyRoutine({
  weekPlan,
  routineTasks,
  columns = [],
  projects = [],
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onEditWeek,
}) {
  const [addingDay, setAddingDay] = useState(null);
  const addBtnRefs = useRef({});

  const days = weekPlan?.days || [];

  // Build a map of routineTask._id → { manualColor, conditionalColor }
  const taskColorMap = useMemo(() => {
    const map = {};
    for (const rt of routineTasks) {
      const manualColor = rt.color || "";
      let conditionalColor = "";
      for (const col of columns) {
        if (col.type !== "dropdown" || !col.colorRules?.length) continue;
        const field = (rt.customFields || []).find(
          (f) => String(f.column) === String(col._id),
        );
        if (!field?.value) continue;
        const rule = col.colorRules.find((r) => r.value === field.value);
        if (rule?.color) {
          conditionalColor = rule.color;
          break;
        }
      }
      map[rt._id] = { manualColor, conditionalColor };
    }
    return map;
  }, [routineTasks, columns]);

  // Map routineTask._id → project id
  const rtProjectMap = useMemo(() => {
    const map = {};
    for (const rt of routineTasks) {
      map[rt._id] =
        typeof rt.project === "object"
          ? rt.project._id || rt.project
          : rt.project;
    }
    return map;
  }, [routineTasks]);

  // Map project id → name
  const projectNameMap = useMemo(() => {
    const map = {};
    for (const p of projects) map[p._id] = p.name;
    return map;
  }, [projects]);

  // Get the project id for a week-plan task
  const getTaskProjectId = useCallback(
    (task) => {
      if (!task.routineTask) return null;
      const rtId =
        typeof task.routineTask === "object"
          ? task.routineTask._id || task.routineTask
          : task.routineTask;
      return rtProjectMap[rtId] || null;
    },
    [rtProjectMap],
  );

  // Ordered list of project IDs that appear in this week plan, plus "other"
  const projectSections = useMemo(() => {
    const seen = new Set();
    const order = [];
    // Use the weekPlan.projects ordering if available
    for (const pid of weekPlan?.projects || []) {
      const id = String(pid);
      if (!seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
    // Also scan actual tasks in case there are tasks for unlisted projects
    for (const day of days) {
      for (const task of day.tasks) {
        const pid = getTaskProjectId(task);
        if (pid && !seen.has(String(pid))) {
          seen.add(String(pid));
          order.push(String(pid));
        }
      }
    }
    // Check if there are any ad-hoc (no project) tasks
    let hasOther = false;
    for (const day of days) {
      for (const task of day.tasks) {
        if (!getTaskProjectId(task)) {
          hasOther = true;
          break;
        }
      }
      if (hasOther) break;
    }
    return { projectIds: order, hasOther };
  }, [weekPlan?.projects, days, getTaskProjectId]);

  // For each project section + day: list of tasks
  const tasksByProjectAndDay = useMemo(() => {
    const map = {}; // { [projectId|"other"]: { [dayOfWeek]: task[] } }
    for (const pid of projectSections.projectIds) {
      map[pid] = {};
      for (let d = 0; d < 7; d++) map[pid][d] = [];
    }
    if (projectSections.hasOther) {
      map["other"] = {};
      for (let d = 0; d < 7; d++) map["other"][d] = [];
    }
    for (const day of days) {
      for (const task of day.tasks) {
        const pid = getTaskProjectId(task);
        const key = pid ? String(pid) : "other";
        if (!map[key]) {
          map[key] = {};
          for (let d = 0; d < 7; d++) map[key][d] = [];
        }
        map[key][day.dayOfWeek].push(task);
      }
    }
    return map;
  }, [days, projectSections, getTaskProjectId]);

  // Max tasks per project section
  const maxTasksPerSection = useMemo(() => {
    const map = {};
    for (const [section, byDay] of Object.entries(tasksByProjectAndDay)) {
      map[section] = Math.max(
        ...Object.values(byDay).map((arr) => arr.length),
        0,
      );
    }
    return map;
  }, [tasksByProjectAndDay]);

  // All section keys in order
  const sectionKeys = useMemo(() => {
    const keys = [...projectSections.projectIds];
    if (projectSections.hasOther) keys.push("other");
    return keys;
  }, [projectSections]);

  // Routine tasks filtered by project (for add-task popover)
  const routineTasksByProject = useMemo(() => {
    const map = {};
    for (const rt of routineTasks) {
      const pid =
        typeof rt.project === "object"
          ? rt.project._id || rt.project
          : rt.project;
      const key = String(pid);
      if (!map[key]) map[key] = [];
      map[key].push(rt);
    }
    return map;
  }, [routineTasks]);

  // Compute date for each day
  const dayDates = useMemo(() => {
    if (!weekPlan?.weekStart) return [];
    const start = new Date(weekPlan.weekStart + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }, [weekPlan?.weekStart]);

  // Compute date range string
  const dateRange = useMemo(() => {
    if (!weekPlan?.weekStart) return "";
    const start = new Date(weekPlan.weekStart + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    return `${fmt(start)} - ${fmt(end)}`;
  }, [weekPlan?.weekStart]);

  // Find today's dayOfWeek (0=Mon..6=Sun)
  const todayDow = useMemo(() => {
    const jsDay = new Date().getDay(); // 0=Sun
    return jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon
  }, []);

  if (!weekPlan) return null;

  // Helper to render a task cell
  const renderTaskCell = (task, dayIdx) => {
    if (!task) return null;
    const rtId = task.routineTask
      ? typeof task.routineTask === "object"
        ? task.routineTask._id || task.routineTask
        : task.routineTask
      : null;
    const colors = rtId ? taskColorMap[rtId] : null;

    return (
      <div className="flex items-center gap-1.5 group">
        {colors ? (
          <TaskColorLines
            manualColor={colors.manualColor}
            conditionalColor={colors.conditionalColor}
          />
        ) : null}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span
            className={`text-xs truncate ${
              task.completed
                ? "line-through text-gray-400 dark:text-gray-500"
                : "text-gray-700 dark:text-gray-200"
            }`}
            title={task.taskName}
          >
            {task.taskName}
          </span>
        </div>
        {task.estimatedTime ? (
          <span className="text-[10px] text-gray-400 shrink-0">
            {task.estimatedTime}
          </span>
        ) : null}
        <button
          type="button"
          className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
            task.completed
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 dark:border-gray-600 hover:border-green-400"
          }`}
          onClick={() => onToggleTask(dayIdx, task._id, !task.completed)}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        >
          {task.completed ? <IconCheck className="w-3 h-3" /> : null}
        </button>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all shrink-0"
          onClick={() => onDeleteTask(dayIdx, task._id)}
          aria-label="Remove task"
        >
          <IconTrash className="w-3 h-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {weekPlan.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {dateRange}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Daily Study Time:
          </span>
          <span className="text-sm font-semibold px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {formatMinutes(weekPlan.estimatedDailyTime)}
          </span>
          {onEditWeek ? (
            <button
              type="button"
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              onClick={() => onEditWeek(weekPlan)}
              aria-label="Edit week"
              title="Edit week"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Desktop grid */}
      <div className="hidden md:block overflow-x-auto">
        <div className="bg-white/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold text-white bg-red-600 border-r border-red-700 w-[60px] rounded-tl-2xl">
                  {weekPlan.name}
                </th>
                {DAY_NAMES.map((name, i) => {
                  const isToday = i === todayDow;
                  const dayData = days.find((d) => d.dayOfWeek === i);
                  const completedCount = dayData
                    ? dayData.tasks.filter((t) => t.completed).length
                    : 0;
                  const totalCount = dayData ? dayData.tasks.length : 0;
                  const allDone =
                    totalCount > 0 && completedCount === totalCount;

                  return (
                    <th
                      key={i}
                      className={`px-3 py-2 text-center text-xs font-bold border-r last:border-r-0 ${
                        isToday
                          ? "bg-blue-600 text-white border-blue-700"
                          : allDone
                            ? "bg-green-600/20 text-green-700 dark:text-green-300 border-gray-200 dark:border-gray-700"
                            : "bg-blue-800 text-white border-blue-900"
                      }`}
                    >
                      <div>{name}</div>
                      {dayDates[i] ? (
                        <div className="text-[10px] opacity-80 font-normal">
                          {dayDates[i]}
                        </div>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sectionKeys.map((sectionKey, sectionIdx) => {
                const sectionName =
                  sectionKey === "other"
                    ? "Other"
                    : projectNameMap[sectionKey] || "Project";
                const maxRows = maxTasksPerSection[sectionKey] || 0;
                const byDay = tasksByProjectAndDay[sectionKey] || {};
                // Routine tasks for this project's add-task popover
                const sectionRoutineTasks =
                  sectionKey === "other"
                    ? routineTasks
                    : routineTasksByProject[sectionKey] || [];

                return (
                  <React.Fragment key={sectionKey}>
                    {/* Project header row */}
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-1.5 text-xs font-bold text-blue-100 bg-blue-900/80 dark:bg-blue-900/60 border-b border-blue-800/40"
                      >
                        {sectionName}
                      </td>
                    </tr>
                    {/* Task rows */}
                    {Array.from(
                      { length: Math.max(maxRows + 1, 1) },
                      (_, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className="border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                        >
                          <td className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500 border-r border-gray-200 dark:border-gray-700 font-medium">
                            {rowIdx + 1}
                          </td>
                          {DAY_NAMES.map((_, dayIdx) => {
                            const dayTasks = byDay[dayIdx] || [];
                            const task = dayTasks[rowIdx];

                            if (!task) {
                              // Show add button only in the first empty row for this section
                              if (rowIdx === dayTasks.length) {
                                const addKey = `desktop-${sectionKey}-${dayIdx}`;
                                return (
                                  <td
                                    key={dayIdx}
                                    className="px-2 py-1 border-r last:border-r-0 border-gray-100 dark:border-gray-800 relative"
                                  >
                                    <button
                                      ref={(el) => {
                                        addBtnRefs.current[addKey] = el;
                                      }}
                                      type="button"
                                      className="w-full flex items-center justify-center gap-1 py-1 rounded text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                      onClick={() =>
                                        setAddingDay(
                                          addingDay === addKey ? null : addKey,
                                        )
                                      }
                                    >
                                      <IconPlus className="w-3 h-3" />
                                    </button>
                                    <AnimatePresence>
                                      {addingDay === addKey ? (
                                        <AddTaskPopover
                                          routineTasks={sectionRoutineTasks}
                                          onAdd={(data) =>
                                            onAddTask(dayIdx, data)
                                          }
                                          onClose={() => setAddingDay(null)}
                                          anchorRef={{
                                            current: addBtnRefs.current[addKey],
                                          }}
                                        />
                                      ) : null}
                                    </AnimatePresence>
                                  </td>
                                );
                              }
                              return (
                                <td
                                  key={dayIdx}
                                  className="px-2 py-1 border-r last:border-r-0 border-gray-100 dark:border-gray-800"
                                />
                              );
                            }

                            return (
                              <td
                                key={dayIdx}
                                className={`px-2 py-1 border-r last:border-r-0 border-gray-100 dark:border-gray-800 ${
                                  task.completed
                                    ? "bg-green-50/50 dark:bg-green-900/10"
                                    : ""
                                }`}
                              >
                                {renderTaskCell(task, dayIdx)}
                              </td>
                            );
                          })}
                        </tr>
                      ),
                    )}
                  </React.Fragment>
                );
              })}

              {/* If no sections at all, show a single add row */}
              {!sectionKeys.length ? (
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500 border-r border-gray-200 dark:border-gray-700 font-medium">
                    1
                  </td>
                  {DAY_NAMES.map((_, dayIdx) => {
                    const addKey = `desktop-empty-${dayIdx}`;
                    return (
                      <td
                        key={dayIdx}
                        className="px-2 py-1 border-r last:border-r-0 border-gray-100 dark:border-gray-800 relative"
                      >
                        <button
                          ref={(el) => {
                            addBtnRefs.current[addKey] = el;
                          }}
                          type="button"
                          className="w-full flex items-center justify-center gap-1 py-1 rounded text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          onClick={() =>
                            setAddingDay(addingDay === addKey ? null : addKey)
                          }
                        >
                          <IconPlus className="w-3 h-3" />
                        </button>
                        <AnimatePresence>
                          {addingDay === addKey ? (
                            <AddTaskPopover
                              routineTasks={routineTasks}
                              onAdd={(data) => onAddTask(dayIdx, data)}
                              onClose={() => setAddingDay(null)}
                              anchorRef={{
                                current: addBtnRefs.current[addKey],
                              }}
                            />
                          ) : null}
                        </AnimatePresence>
                      </td>
                    );
                  })}
                </tr>
              ) : null}

              {/* Totals row */}
              <tr className="bg-gray-50/80 dark:bg-gray-800/40 border-t border-gray-200 dark:border-gray-700">
                <td className="px-2 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">
                  Total
                </td>
                {DAY_NAMES.map((_, dayIdx) => {
                  const dayData = days.find((d) => d.dayOfWeek === dayIdx);
                  const totalMin = dayData
                    ? dayData.tasks.reduce(
                        (s, t) => s + (t.estimatedTime || 0),
                        0,
                      )
                    : 0;
                  const completedMin = dayData
                    ? dayData.tasks
                        .filter((t) => t.completed)
                        .reduce((s, t) => s + (t.estimatedTime || 0), 0)
                    : 0;
                  const pct =
                    totalMin > 0
                      ? Math.round((completedMin / totalMin) * 100)
                      : 0;

                  return (
                    <td
                      key={dayIdx}
                      className="px-2 py-2 text-center border-r last:border-r-0 border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 shrink-0 whitespace-nowrap">
                          {formatMinutes(totalMin)}
                        </span>
                        {totalMin > 0 ? (
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct === 100
                                  ? "bg-green-500"
                                  : pct > 50
                                    ? "bg-blue-500"
                                    : "bg-orange-400"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: stacked day cards */}
      <div className="md:hidden space-y-3">
        {DAY_NAMES.map((name, dayIdx) => {
          const dayData = days.find((d) => d.dayOfWeek === dayIdx);
          const tasks = dayData?.tasks || [];
          const totalMin = tasks.reduce(
            (s, t) => s + (t.estimatedTime || 0),
            0,
          );
          const completedMin = tasks
            .filter((t) => t.completed)
            .reduce((s, t) => s + (t.estimatedTime || 0), 0);
          const pct =
            totalMin > 0 ? Math.round((completedMin / totalMin) * 100) : 0;
          const isToday = dayIdx === todayDow;

          // Group this day's tasks by project
          const dayTasksByProject = {};
          for (const task of tasks) {
            const pid = getTaskProjectId(task);
            const key = pid ? String(pid) : "other";
            if (!dayTasksByProject[key]) dayTasksByProject[key] = [];
            dayTasksByProject[key].push(task);
          }

          return (
            <div
              key={dayIdx}
              className={`bg-white/80 dark:bg-gray-900/40 border rounded-xl overflow-hidden ${
                isToday
                  ? "border-blue-400 dark:border-blue-600 ring-1 ring-blue-200 dark:ring-blue-800"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div
                className={`px-4 py-2 font-semibold text-sm ${
                  isToday ? "bg-blue-600 text-white" : "bg-blue-800 text-white"
                }`}
              >
                {name}
                {dayDates[dayIdx] ? (
                  <span className="ml-2 text-xs opacity-80 font-normal">
                    {dayDates[dayIdx]}
                  </span>
                ) : null}
              </div>

              <div className="p-3 space-y-3">
                {sectionKeys.map((sectionKey, sectionIdx) => {
                  const sectionTasks = dayTasksByProject[sectionKey] || [];
                  const sectionName =
                    sectionKey === "other"
                      ? "Other"
                      : projectNameMap[sectionKey] || "Project";
                  const sectionRoutineTasks =
                    sectionKey === "other"
                      ? routineTasks
                      : routineTasksByProject[sectionKey] || [];
                  const addKey = `mobile-${sectionKey}-${dayIdx}`;

                  return (
                    <div key={sectionKey}>
                      <div className="text-[10px] font-bold text-blue-100 bg-blue-900/80 dark:bg-blue-900/60 px-2 py-0.5 rounded-md mb-1.5 inline-block">
                        {sectionName}
                      </div>
                      <div className="space-y-2">
                        {sectionTasks.map((task) => {
                          const rtId = task.routineTask
                            ? typeof task.routineTask === "object"
                              ? task.routineTask._id || task.routineTask
                              : task.routineTask
                            : null;
                          const colors = rtId ? taskColorMap[rtId] : null;
                          return (
                            <div
                              key={task._id}
                              className={`flex items-center gap-2 p-2 rounded-lg ${
                                task.completed
                                  ? "bg-green-50 dark:bg-green-900/10"
                                  : "bg-gray-50 dark:bg-gray-800/30"
                              }`}
                            >
                              {colors ? (
                                <TaskColorLines
                                  manualColor={colors.manualColor}
                                  conditionalColor={colors.conditionalColor}
                                />
                              ) : null}
                              <button
                                type="button"
                                className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                                  task.completed
                                    ? "bg-green-500 border-green-500 text-white"
                                    : "border-gray-300 dark:border-gray-600 hover:border-green-400"
                                }`}
                                onClick={() =>
                                  onToggleTask(
                                    dayIdx,
                                    task._id,
                                    !task.completed,
                                  )
                                }
                              >
                                {task.completed ? (
                                  <IconCheck className="w-3.5 h-3.5" />
                                ) : null}
                              </button>
                              <span
                                className={`flex-1 text-sm ${
                                  task.completed
                                    ? "line-through text-gray-400"
                                    : "text-gray-700 dark:text-gray-200"
                                }`}
                              >
                                {task.taskName}
                              </span>
                              {task.estimatedTime ? (
                                <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                                  {task.estimatedTime}m
                                </span>
                              ) : null}
                              <button
                                type="button"
                                className="p-1 text-gray-400 hover:text-red-500"
                                onClick={() => onDeleteTask(dayIdx, task._id)}
                              >
                                <IconTrash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}

                        <div className="relative">
                          <button
                            ref={(el) => {
                              addBtnRefs.current[addKey] = el;
                            }}
                            type="button"
                            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border border-dashed border-gray-200 dark:border-gray-700"
                            onClick={() =>
                              setAddingDay(addingDay === addKey ? null : addKey)
                            }
                          >
                            <IconPlus className="w-3.5 h-3.5" />
                            Add task
                          </button>
                          <AnimatePresence>
                            {addingDay === addKey ? (
                              <AddTaskPopover
                                routineTasks={sectionRoutineTasks}
                                onAdd={(data) => onAddTask(dayIdx, data)}
                                onClose={() => setAddingDay(null)}
                                anchorRef={{
                                  current: addBtnRefs.current[addKey],
                                }}
                              />
                            ) : null}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* If no sections, show generic add */}
                {!sectionKeys.length ? (
                  <div className="relative">
                    <button
                      ref={(el) => {
                        addBtnRefs.current[`mobile-${dayIdx}`] = el;
                      }}
                      type="button"
                      className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border border-dashed border-gray-200 dark:border-gray-700"
                      onClick={() =>
                        setAddingDay(addingDay === dayIdx ? null : dayIdx)
                      }
                    >
                      <IconPlus className="w-3.5 h-3.5" />
                      Add task
                    </button>
                    <AnimatePresence>
                      {addingDay === dayIdx ? (
                        <AddTaskPopover
                          routineTasks={routineTasks}
                          onAdd={(data) => onAddTask(dayIdx, data)}
                          onClose={() => setAddingDay(null)}
                          anchorRef={{
                            current: addBtnRefs.current[`mobile-${dayIdx}`],
                          }}
                        />
                      ) : null}
                    </AnimatePresence>
                  </div>
                ) : null}
              </div>

              {/* Day total + progress */}
              <div className="px-4 py-2 bg-gray-50/80 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-600 dark:text-gray-400">
                    Total: {formatMinutes(totalMin)}
                  </span>
                  {totalMin > 0 ? (
                    <span className="text-gray-400">{pct}%</span>
                  ) : null}
                </div>
                {totalMin > 0 ? (
                  <div className="mt-1 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct === 100
                          ? "bg-green-500"
                          : pct > 50
                            ? "bg-blue-500"
                            : "bg-orange-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
