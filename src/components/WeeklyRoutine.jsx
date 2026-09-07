"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { AnimatePresence } from "framer-motion";
import { weekLabel } from "@/utils/timeUtils";
import {
  formatMinutes,
  minutesToTime,
  IconPlus,
  IconCheck,
  IconDotsVertical,
  IconNote,
  AddTaskPopover,
  TaskEditPopover,
  TaskColorLines,
} from "./weekplan/WeekPlanShared";
import WeekCalendar from "./weekplan/WeekCalendar";

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
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];


/* ── Main WeeklyRoutine Component ──────────────────────── */

export default function WeeklyRoutine({
  weekPlan,
  routineTasks,
  columns = [],
  projects = [],
  tasks = [],
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onMoveTask,
  onEditWeek,
  // "list" (project rows per day) or "calendar" (hour grid); chosen by the
  // planner tab that renders this component.
  view = "list",
}) {
  const [addingDay, setAddingDay] = useState(null);
  const [editingTaskKey, setEditingTaskKey] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const addBtnRefs = useRef({});
  const editBtnRefs = useRef({});

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

  // Pending (incomplete) todo tasks, optionally scoped to a project
  const todoTasks = useMemo(
    () => (tasks || []).filter((t) => !t.completed),
    [tasks],
  );

  // Tasks with an explicit scheduledDate that falls inside this week's grid.
  // Each entry is enriched with the matching dayOfWeek (0=Mon..6=Sun).
  const datedTasksInWeek = useMemo(() => {
    if (!weekPlan?.weekStart) return [];
    const weekStart = new Date(weekPlan.weekStart + "T00:00:00");
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const out = [];
    for (const t of tasks || []) {
      if (!t.scheduledDate || t.completed) continue;
      const d = new Date(t.scheduledDate);
      if (Number.isNaN(d.getTime())) continue;
      const local = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        0,
        0,
        0,
        0,
      );
      if (local < weekStart || local >= weekEnd) continue;
      const dayOfWeek = Math.floor(
        (local.getTime() - weekStart.getTime()) / 86400000,
      );
      if (dayOfWeek < 0 || dayOfWeek > 6) continue;
      out.push({ task: t, dayOfWeek });
    }
    return out;
  }, [tasks, weekPlan?.weekStart]);

  // Get the project id for a week-plan task
  const getTaskProjectId = useCallback(
    (task) => {
      if (task.project) {
        return typeof task.project === "object"
          ? String(task.project._id || task.project)
          : String(task.project);
      }
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
    // Include projects that contribute dated Tasks for this week
    for (const { task } of datedTasksInWeek) {
      const pid = task.project
        ? typeof task.project === "object"
          ? String(task.project._id || task.project)
          : String(task.project)
        : null;
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        order.push(pid);
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
  }, [weekPlan?.projects, days, getTaskProjectId, datedTasksInWeek]);

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
    // Inject virtual auto-scheduled routine tasks (display-only).
    // Skip days where a real task already references the same routine task.
    for (const rt of routineTasks) {
      if (!rt.autoSchedule) continue;
      const freqs =
        Array.isArray(rt.frequencies) && rt.frequencies.length
          ? rt.frequencies
          : rt.frequency
            ? [rt.frequency]
            : [];
      if (!freqs.length) continue;
      const dayIdxs = freqs.includes("daily")
        ? [0, 1, 2, 3, 4, 5, 6]
        : freqs
            .map((f) => DAY_KEYS.indexOf(f))
            .filter((i) => i >= 0);
      if (!dayIdxs.length) continue;
      const pid =
        typeof rt.project === "object"
          ? String(rt.project._id || rt.project)
          : String(rt.project);
      const sectionKey = pid;
      if (!map[sectionKey]) {
        map[sectionKey] = {};
        for (let d = 0; d < 7; d++) map[sectionKey][d] = [];
      }
      for (const dayIdx of dayIdxs) {
        const arr = map[sectionKey][dayIdx];
        const already = arr.some((t) => {
          if (!t.routineTask) return false;
          const id =
            typeof t.routineTask === "object"
              ? String(t.routineTask._id || t.routineTask)
              : String(t.routineTask);
          return id === String(rt._id);
        });
        if (already) continue;
        arr.unshift({
          _id: `__auto_${rt._id}_${dayIdx}`,
          _virtual: true,
          routineTask: rt._id,
          taskName: rt.title,
          estimatedTime: rt.estimatedTime || 0,
          completed: false,
        });
      }
    }
    // Inject dated Task entries (display-only; cannot be edited or dragged here).
    for (const { task, dayOfWeek } of datedTasksInWeek) {
      const pid = task.project
        ? typeof task.project === "object"
          ? String(task.project._id || task.project)
          : String(task.project)
        : null;
      const key = pid || "other";
      if (!map[key]) {
        map[key] = {};
        for (let d = 0; d < 7; d++) map[key][d] = [];
      }
      map[key][dayOfWeek].push({
        _id: `__dated_${task._id}`,
        _virtual: true,
        _dated: true,
        taskName: task.title,
        completed: false,
      });
    }
    return map;
  }, [days, projectSections, getTaskProjectId, routineTasks, datedTasksInWeek]);

  // Flat list of displayed tasks per day (includes virtuals) — for totals/mobile.
  const dayDisplayTasks = useMemo(() => {
    const out = Array.from({ length: 7 }, () => []);
    for (const byDay of Object.values(tasksByProjectAndDay)) {
      for (let d = 0; d < 7; d++) {
        if (byDay[d]?.length) out[d].push(...byDay[d]);
      }
    }
    return out;
  }, [tasksByProjectAndDay]);

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
    const editKey = `edit-${dayIdx}-${task._id}`;
    const canDrag = !task._virtual && !task.completed;

    return (
      <div
        className={`flex items-center gap-1.5 group ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
        draggable={canDrag}
        onDragStart={(e) => {
          if (!canDrag) return;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData(
            "application/json",
            JSON.stringify({ taskId: String(task._id), fromDayOfWeek: dayIdx }),
          );
          // text/plain fallback to keep some browsers happy
          e.dataTransfer.setData("text/plain", String(task._id));
        }}
      >
        {colors ? (
          <TaskColorLines
            manualColor={colors.manualColor}
            conditionalColor={colors.conditionalColor}
          />
        ) : null}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {task._virtual && !task._dated ? (
            <span
              title="Auto-scheduled from routine"
              className="text-[10px] px-1 py-0.5 rounded bg-warning-soft text-warning shrink-0"
            >
              ⚡
            </span>
          ) : null}
          {task._dated ? (
            <span
              title="Scheduled from Tasks"
              className="shrink-0 text-primary"
              aria-label="Scheduled from Tasks"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-3 h-3"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path strokeLinecap="round" d="M3 9h18M8 3v4M16 3v4" />
              </svg>
            </span>
          ) : null}
          <span
            className={`text-xs truncate ${
              task.completed
                ? "line-through text-fg-subtle"
                : task._dated
                  ? "text-fg"
                  : task._virtual
                    ? "text-fg-muted italic"
                    : "text-fg"
            }`}
            title={task.notes || task.taskName}
          >
            {task.taskName}
          </span>
          {task.notes ? (
            <span
              className="shrink-0 text-warning"
              title={task.notes}
              aria-label="Has notes"
            >
              <IconNote className="w-3 h-3" />
            </span>
          ) : null}
        </div>
        {task.startMinute != null ? (
          <span
            className="text-[10px] text-primary shrink-0 tabular-nums"
            title="Scheduled time"
          >
            {minutesToTime(task.startMinute)}
          </span>
        ) : null}
        {task.estimatedTime ? (
          <span className="text-[10px] text-fg-subtle shrink-0">
            {task.estimatedTime}
          </span>
        ) : null}
        {task._virtual ? (
          task._dated ? null : (
            <button
              type="button"
              className="w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors border-dashed border-warning/70 hover:border-success hover:bg-success-soft"
              onClick={() => {
                const rtId = task.routineTask
                  ? typeof task.routineTask === "object"
                    ? task.routineTask._id || task.routineTask
                    : task.routineTask
                  : null;
                const pid = getTaskProjectId(task);
                onAddTask?.(dayIdx, {
                  routineTaskId: rtId,
                  projectId: pid,
                  taskName: task.taskName,
                  estimatedTime: task.estimatedTime || 0,
                  completed: true,
                });
              }}
              aria-label="Mark complete"
              title="Mark complete"
            />
          )
        ) : (
          <>
            <button
              type="button"
              className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                task.completed
                  ? "bg-success border-success text-white"
                  : "border-edge hover:border-success"
              }`}
              onClick={() => onToggleTask(dayIdx, task._id, !task.completed)}
              aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
            >
              {task.completed ? <IconCheck className="w-3 h-3" /> : null}
            </button>
            <div className="relative shrink-0">
              <button
                ref={(el) => {
                  editBtnRefs.current[editKey] = el;
                }}
                type="button"
                className="opacity-0 group-hover:opacity-100 p-0.5 text-fg-subtle hover:text-primary transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTaskKey((cur) =>
                    cur === editKey ? null : editKey,
                  );
                }}
                aria-label="Task options"
              >
                <IconDotsVertical className="w-3.5 h-3.5" />
              </button>
              {editingTaskKey === editKey ? (
                <TaskEditPopover
                  task={task}
                  onSave={(updates) =>
                    onUpdateTask?.(dayIdx, task._id, updates)
                  }
                  onDelete={() => onDeleteTask(dayIdx, task._id)}
                  onClose={() => setEditingTaskKey(null)}
                  anchorRef={{
                    current: editBtnRefs.current[editKey],
                  }}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    );
  };

  // Drop handler for a cell that targets a specific day + section
  const makeCellDropHandlers = (cellKey, dayIdx, sectionKey) => ({
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    onDragEnter: () => setDragOverCell(cellKey),
    onDragLeave: (e) => {
      // Only clear if the cursor actually left the cell
      if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget)) {
        setDragOverCell((cur) => (cur === cellKey ? null : cur));
      }
    },
    onDrop: (e) => {
      e.preventDefault();
      setDragOverCell(null);
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      if (!parsed?.taskId) return;
      onMoveTask?.({
        taskId: parsed.taskId,
        fromDayOfWeek: parsed.fromDayOfWeek,
        toDayOfWeek: dayIdx,
        toProjectId: sectionKey === "other" ? null : sectionKey,
      });
    },
  });

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-bold text-fg">
            {weekLabel(weekPlan.weekStart)}
          </h3>
          <p className="text-sm text-fg-subtle">
            {dateRange}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onEditWeek ? (
            <button
              type="button"
              className="p-1.5 rounded-lg text-fg-subtle hover:text-primary hover:bg-primary-soft transition-colors"
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

      {view === "calendar" ? (
        <WeekCalendar
          weekPlan={weekPlan}
          dayTasks={dayDisplayTasks}
          dayDates={dayDates}
          todayDow={todayDow}
          routineTasks={routineTasks}
          todoTasks={todoTasks}
          projectNameMap={projectNameMap}
          taskColorMap={taskColorMap}
          getTaskProjectId={getTaskProjectId}
          onAddTask={onAddTask}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
          onUpdateTask={onUpdateTask}
          onMoveTask={onMoveTask}
        />
      ) : (
        <>
      {/* Desktop grid */}
      <div className="hidden md:block overflow-x-auto">
        <div className="bg-surface border border-edge rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold text-accent-fg bg-accent border-r border-accent-hover w-[60px] rounded-tl-2xl">
                  {weekLabel(weekPlan.weekStart)}
                </th>
                {DAY_NAMES.map((name, i) => {
                  const isToday = i === todayDow;
                  const dTasks = dayDisplayTasks[i] || [];
                  const completedCount = dTasks.filter((t) => t.completed).length;
                  const totalCount = dTasks.length;
                  const allDone =
                    totalCount > 0 && completedCount === totalCount;

                  return (
                    <th
                      key={i}
                      className={`px-3 py-2 text-center text-xs font-bold border-r last:border-r-0 ${
                        isToday
                          ? "bg-primary text-primary-fg border-primary-hover"
                          : allDone
                            ? "bg-success-soft text-success border-edge"
                            : "bg-primary-hover text-primary-fg border-primary"
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
                // Incomplete todo tasks scoped to this project
                const sectionTodoTasks = todoTasks.filter((t) => {
                  const pid = t.project
                    ? typeof t.project === "object"
                      ? String(t.project._id || t.project)
                      : String(t.project)
                    : "other";
                  return sectionKey === "other" ? true : pid === sectionKey;
                });

                return (
                  <React.Fragment key={sectionKey}>
                    {/* Project header row */}
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-1.5 text-xs font-bold text-primary bg-primary-soft border-b border-edge"
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
                          className="border-b border-edge last:border-b-0"
                        >
                          <td className="px-2 py-1 text-xs text-fg-subtle border-r border-edge font-medium">
                            {rowIdx + 1}
                          </td>
                          {DAY_NAMES.map((_, dayIdx) => {
                            const dayTasks = byDay[dayIdx] || [];
                            const task = dayTasks[rowIdx];

                            const cellKey = `cell-${sectionKey}-${dayIdx}-${rowIdx}`;
                            const dropHandlers = makeCellDropHandlers(
                              cellKey,
                              dayIdx,
                              sectionKey,
                            );
                            const dropHighlight =
                              dragOverCell === cellKey
                                ? "bg-primary-soft"
                                : "";

                            if (!task) {
                              // Show add button only in the first empty row for this section
                              if (rowIdx === dayTasks.length) {
                                const addKey = `desktop-${sectionKey}-${dayIdx}`;
                                return (
                                  <td
                                    key={dayIdx}
                                    className={`px-2 py-1 border-r last:border-r-0 border-edge relative ${dropHighlight}`}
                                    {...dropHandlers}
                                  >
                                    <button
                                      ref={(el) => {
                                        addBtnRefs.current[addKey] = el;
                                      }}
                                      type="button"
                                      className="w-full flex items-center justify-center gap-1 py-1 rounded text-xs text-fg-subtle hover:text-primary hover:bg-primary-soft transition-colors"
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
                                          todoTasks={sectionTodoTasks}
                                          projectNameMap={projectNameMap}
                                          projectId={
                                            sectionKey === "other"
                                              ? null
                                              : sectionKey
                                          }
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
                                  className={`px-2 py-1 border-r last:border-r-0 border-edge ${dropHighlight}`}
                                  {...dropHandlers}
                                />
                              );
                            }

                            return (
                              <td
                                key={dayIdx}
                                className={`px-2 py-1 border-r last:border-r-0 border-edge ${
                                  task.completed
                                    ? "bg-success-soft/50"
                                    : ""
                                } ${dropHighlight}`}
                                {...dropHandlers}
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
                <tr className="border-b border-edge">
                  <td className="px-2 py-1 text-xs text-fg-subtle border-r border-edge font-medium">
                    1
                  </td>
                  {DAY_NAMES.map((_, dayIdx) => {
                    const addKey = `desktop-empty-${dayIdx}`;
                    const cellKey = `cell-empty-${dayIdx}`;
                    const dropHandlers = makeCellDropHandlers(
                      cellKey,
                      dayIdx,
                      "other",
                    );
                    const dropHighlight =
                      dragOverCell === cellKey
                        ? "bg-primary-soft"
                        : "";
                    return (
                      <td
                        key={dayIdx}
                        className={`px-2 py-1 border-r last:border-r-0 border-edge relative ${dropHighlight}`}
                        {...dropHandlers}
                      >
                        <button
                          ref={(el) => {
                            addBtnRefs.current[addKey] = el;
                          }}
                          type="button"
                          className="w-full flex items-center justify-center gap-1 py-1 rounded text-xs text-fg-subtle hover:text-primary hover:bg-primary-soft transition-colors"
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
                              todoTasks={todoTasks}
                              projectNameMap={projectNameMap}
                              projectId={null}
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
              <tr className="bg-surface-2 border-t border-edge">
                <td className="px-2 py-2 text-xs font-bold text-fg-muted border-r border-edge">
                  Total
                </td>
                {DAY_NAMES.map((_, dayIdx) => {
                  const dTasks = dayDisplayTasks[dayIdx] || [];
                  const totalMin = dTasks.reduce(
                    (s, t) => s + (t.estimatedTime || 0),
                    0,
                  );
                  const completedMin = dTasks
                    .filter((t) => t.completed)
                    .reduce((s, t) => s + (t.estimatedTime || 0), 0);
                  const pct =
                    totalMin > 0
                      ? Math.round((completedMin / totalMin) * 100)
                      : 0;

                  return (
                    <td
                      key={dayIdx}
                      className="px-2 py-2 text-center border-r last:border-r-0 border-edge"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-fg-muted shrink-0 whitespace-nowrap">
                          {formatMinutes(totalMin)}
                        </span>
                        {totalMin > 0 ? (
                          <div className="flex-1 h-1.5 bg-edge rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct === 100
                                  ? "bg-success"
                                  : pct > 50
                                    ? "bg-primary"
                                    : "bg-warning"
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
          const tasks = dayDisplayTasks[dayIdx] || [];
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

          // Group this day's tasks by project (via tasksByProjectAndDay so virtuals appear)
          const dayTasksByProject = {};
          for (const sk of sectionKeys) {
            dayTasksByProject[sk] = tasksByProjectAndDay[sk]?.[dayIdx] || [];
          }

          return (
            <div
              key={dayIdx}
              className={`bg-surface border rounded-xl overflow-hidden ${
                isToday
                  ? "border-primary ring-1 ring-focus/40"
                  : "border-edge"
              }`}
            >
              <div
                className={`px-4 py-2 font-semibold text-sm ${
                  isToday ? "bg-primary text-primary-fg" : "bg-primary-hover text-primary-fg"
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
                  const sectionTodoTasks = todoTasks.filter((t) => {
                    const pid = t.project
                      ? typeof t.project === "object"
                        ? String(t.project._id || t.project)
                        : String(t.project)
                      : "other";
                    return sectionKey === "other" ? true : pid === sectionKey;
                  });
                  const addKey = `mobile-${sectionKey}-${dayIdx}`;

                  const mobileSectionDropKey = `mobile-cell-${sectionKey}-${dayIdx}`;
                  const mobileDropHandlers = makeCellDropHandlers(
                    mobileSectionDropKey,
                    dayIdx,
                    sectionKey,
                  );
                  const mobileDropHighlight =
                    dragOverCell === mobileSectionDropKey
                      ? "ring-1 ring-focus"
                      : "";
                  return (
                    <div
                      key={sectionKey}
                      className={`rounded-md ${mobileDropHighlight}`}
                      {...mobileDropHandlers}
                    >
                      <div className="text-[10px] font-bold text-primary bg-primary-soft px-2 py-0.5 rounded-md mb-1.5 inline-block">
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
                          const editKey = `mobile-edit-${dayIdx}-${task._id}`;
                          const canDrag = !task._virtual && !task.completed;
                          return (
                            <div
                              key={task._id}
                              className={`flex items-center gap-2 p-2 rounded-lg ${
                                task.completed
                                  ? "bg-success-soft"
                                  : "bg-surface-2"
                              } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
                              draggable={canDrag}
                              onDragStart={(e) => {
                                if (!canDrag) return;
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData(
                                  "application/json",
                                  JSON.stringify({
                                    taskId: String(task._id),
                                    fromDayOfWeek: dayIdx,
                                  }),
                                );
                                e.dataTransfer.setData(
                                  "text/plain",
                                  String(task._id),
                                );
                              }}
                            >
                              {colors ? (
                                <TaskColorLines
                                  manualColor={colors.manualColor}
                                  conditionalColor={colors.conditionalColor}
                                />
                              ) : null}
                              {task._virtual ? (
                                task._dated ? (
                                  <span
                                    className="w-5 h-5 shrink-0"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors border-dashed border-warning/70 hover:border-success hover:bg-success-soft"
                                    onClick={() => {
                                      const rtId = task.routineTask
                                        ? typeof task.routineTask === "object"
                                          ? task.routineTask._id ||
                                            task.routineTask
                                          : task.routineTask
                                        : null;
                                      const pid = getTaskProjectId(task);
                                      onAddTask?.(dayIdx, {
                                        routineTaskId: rtId,
                                        projectId: pid,
                                        taskName: task.taskName,
                                        estimatedTime: task.estimatedTime || 0,
                                        completed: true,
                                      });
                                    }}
                                    aria-label="Mark complete"
                                    title="Mark complete"
                                  />
                                )
                              ) : (
                                <button
                                  type="button"
                                  className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                                    task.completed
                                      ? "bg-success border-success text-white"
                                      : "border-edge hover:border-success"
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
                              )}
                              <span
                                className={`flex-1 text-sm ${
                                  task.completed
                                    ? "line-through text-fg-subtle"
                                    : "text-fg"
                                }`}
                                title={task.notes || task.taskName}
                              >
                                {task.taskName}
                              </span>
                              {task.notes ? (
                                <span
                                  className="shrink-0 text-warning"
                                  title={task.notes}
                                  aria-label="Has notes"
                                >
                                  <IconNote className="w-3.5 h-3.5" />
                                </span>
                              ) : null}
                              {task.estimatedTime ? (
                                <span className="text-xs text-fg-subtle px-1.5 py-0.5 bg-surface-2 rounded">
                                  {task.estimatedTime}m
                                </span>
                              ) : null}
                              {task._virtual ? null : (
                                <div className="relative shrink-0">
                                  <button
                                    ref={(el) => {
                                      editBtnRefs.current[editKey] = el;
                                    }}
                                    type="button"
                                    className="p-1 text-fg-subtle hover:text-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTaskKey((cur) =>
                                        cur === editKey ? null : editKey,
                                      );
                                    }}
                                    aria-label="Task options"
                                  >
                                    <IconDotsVertical className="w-3.5 h-3.5" />
                                  </button>
                                  {editingTaskKey === editKey ? (
                                    <TaskEditPopover
                                      task={task}
                                      onSave={(updates) =>
                                        onUpdateTask?.(dayIdx, task._id, updates)
                                      }
                                      onDelete={() =>
                                        onDeleteTask(dayIdx, task._id)
                                      }
                                      onClose={() => setEditingTaskKey(null)}
                                      anchorRef={{
                                        current: editBtnRefs.current[editKey],
                                      }}
                                    />
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <div className="relative">
                          <button
                            ref={(el) => {
                              addBtnRefs.current[addKey] = el;
                            }}
                            type="button"
                            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-fg-subtle hover:text-primary hover:bg-primary-soft transition-colors border border-dashed border-edge"
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
                                todoTasks={sectionTodoTasks}
                                projectNameMap={projectNameMap}
                                projectId={
                                  sectionKey === "other" ? null : sectionKey
                                }
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
                      className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-fg-subtle hover:text-primary hover:bg-primary-soft transition-colors border border-dashed border-edge"
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
                          todoTasks={todoTasks}
                          projectNameMap={projectNameMap}
                          projectId={null}
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
              <div className="px-4 py-2 bg-surface-2 border-t border-edge">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-fg-muted">
                    Total: {formatMinutes(totalMin)}
                  </span>
                  {totalMin > 0 ? (
                    <span className="text-fg-subtle">{pct}%</span>
                  ) : null}
                </div>
                {totalMin > 0 ? (
                  <div className="mt-1 h-1.5 w-full bg-edge rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct === 100
                          ? "bg-success"
                          : pct > 50
                            ? "bg-primary"
                            : "bg-warning"
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
        </>
      )}
    </div>
  );
}
