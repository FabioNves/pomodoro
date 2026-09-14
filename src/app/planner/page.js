"use client";

import React, {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { jwtDecode } from "jwt-decode";
import { getMondayOf, weekLabel } from "@/utils/timeUtils";
import { apiJson } from "@/lib/plannerApi";
import {
  IconChevron,
  IconPlus,
  IconTrash,
  IconDotsVertical,
  isInCurrentWeek,
  compareTasksByOrder,
  TaskRow,
  AddTaskModal,
} from "@/components/planner/TaskRow";
import { COLOR_PALETTES } from "@/lib/habitPalettes";
import { getProjectColorMeta } from "@/lib/projectColors";
import WeeklyRoutine from "@/components/WeeklyRoutine";
import RoutineTasksView from "@/components/RoutineTasksView";
import MilestoneStrip from "@/components/planner/MilestoneStrip";
import ProjectManageModal from "@/components/planner/ProjectManageModal";
import NewProjectModal from "@/components/planner/NewProjectModal";
import SuggestDialog from "@/components/planner/SuggestDialog";
import ProjectPageView from "@/components/planner/ProjectPageView";
import TimelineView from "@/components/planner/TimelineView";
import { compareMilestones, idOf } from "@/lib/milestones";

/* ╔══════════════════════════════════════════════════════╗
   ║  Shared icons                                        ║
   ╚══════════════════════════════════════════════════════╝ */

/* ╔══════════════════════════════════════════════════════╗
   ║  TASKS TAB — colors, components, helpers             ║
   ╚══════════════════════════════════════════════════════╝ */

function ProjectColumn({
  project,
  tasks,
  milestones,
  onAddTask,
  onToggleTask,
  onCreateSubtask,
  onDeleteTask,
  onManage,
  onMoveTask,
  onSetScheduledDate,
  onSetDates,
  onSetTaskMilestone,
  onRenameTask,
  onToggleMilestone,
  onOpenMilestone,
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

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
      <div className="bg-surface border border-edge rounded-2xl shadow-sm overflow-visible">
        <div
          className={`flex items-center justify-between px-4 py-3 border-b border-edge rounded-t-2xl ${collapsed ? "rounded-b-2xl md:rounded-b-none" : ""} ${colorMeta.headerClass}`}
        >
          <button
            type="button"
            className="md:hidden font-semibold text-fg truncate flex items-center gap-2"
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
          <div className="hidden md:block font-semibold text-fg truncate">
            {project.name}
          </div>
          <button
            type="button"
            className="text-fg-subtle hover:text-fg p-1"
            aria-label="Project menu"
            onClick={(e) => {
              e.stopPropagation();
              onManage(project, "project");
            }}
          >
            <IconDotsVertical className="w-5 h-5" />
          </button>
        </div>

        <div className={`${collapsed ? "hidden md:block" : "block"}`}>
          <MilestoneStrip
            milestones={milestones}
            tasks={tasks}
            onManage={(tab) => onManage(project, tab)}
            onToggleComplete={onToggleMilestone}
            onOpenMilestone={(m) => onOpenMilestone(project, m)}
          />
          <div className="px-2 py-2">
            <div className="px-2 pb-2">
              <button
                type="button"
                className="w-full text-left text-sm text-primary hover:text-primary-hover font-medium"
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
                <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider whitespace-nowrap">
                  This Week
                </span>
                <div className="flex-1 h-px bg-edge" />
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
                    onSetDates={onSetDates}
                    onSetMilestone={onSetTaskMilestone}
                    onRenameTask={onRenameTask}
                    milestones={milestones}
                    showMilestoneBadge
                    projectId={project._id}
                    scheduledForLater={false}
                  />
                ))
              ) : (
                <div className="px-4 py-2 text-xs text-fg-subtle italic">
                  No tasks this week
                </div>
              )}
            </div>

            <div className="px-2 mt-3">
              <div className="flex items-center gap-2 py-1 px-1">
                <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider whitespace-nowrap">
                  Later
                </span>
                <div className="flex-1 h-px bg-edge" />
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
                    onSetDates={onSetDates}
                    onSetMilestone={onSetTaskMilestone}
                    onRenameTask={onRenameTask}
                    milestones={milestones}
                    showMilestoneBadge
                    projectId={project._id}
                    scheduledForLater={true}
                  />
                ))
              ) : (
                <div className="px-4 py-2 text-xs text-fg-subtle italic">
                  No tasks scheduled for later
                </div>
              )}
            </div>

            <div className="px-2 pb-3">
              <button
                type="button"
                className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-surface-hover text-sm text-fg-muted"
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
                            onRenameTask={onRenameTask}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="px-2 py-2 text-sm text-fg-subtle">
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
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary-soft transition-colors"
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

function getPalette(color) {
  return COLOR_PALETTES[color] || COLOR_PALETTES.blue;
}

// Index into a palette's shades for an auto-derived (non-manual) level color.
function autoShadeIndex(value, maxLevel, shadeCount = 5) {
  if (!value) return 0;
  return Math.min(
    Math.round((value / maxLevel) * (shadeCount - 1)),
    shadeCount - 1,
  );
}

function getShadeClass(color, level, maxLevel) {
  if (!level) return "bg-surface-2";
  const palette = getPalette(color);
  return palette.shades[autoShadeIndex(level, maxLevel, palette.shades.length)];
}

// Pin every still-auto-shaded level to an explicit color + shade matching its
// CURRENT appearance. Used before adding/removing a level so that the resulting
// change in maxLevel no longer shifts the other levels' colors.
function freezeLevelColors(levels, baseColor) {
  const maxLevel = Math.max(...levels.map((l) => l.value), 1);
  const shadeCount = getPalette(baseColor).shades.length;
  return levels.map((l) =>
    l.color && typeof l.shade === "number"
      ? l
      : {
          ...l,
          color: baseColor,
          shade: autoShadeIndex(l.value, maxLevel, shadeCount),
        },
  );
}

// Resolve the swatch class for a single level. When the level has an explicit
// color + shade (manually chosen by the user) it uses that; otherwise it falls
// back to the auto-derived shade of the habit color (legacy behaviour).
function levelShadeClass(level, fallbackColor, maxLevel) {
  if (
    level &&
    level.color &&
    COLOR_PALETTES[level.color] &&
    typeof level.shade === "number"
  ) {
    const palette = COLOR_PALETTES[level.color];
    const idx = Math.min(Math.max(level.shade, 0), palette.shades.length - 1);
    return palette.shades[idx];
  }
  return getShadeClass(fallbackColor, level?.value, maxLevel);
}

// Popover swatch that lets the user manually pick a color + shade for a level.
function LevelColorPicker({ level, fallbackColor, maxLevel, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-4 h-4 rounded-sm ring-1 ring-edge ${levelShadeClass(level, fallbackColor, maxLevel)}`}
        aria-label="Choose level color"
        title="Choose color"
      />
      {open ? (
        <div className="absolute z-50 top-6 left-0 bg-surface border border-edge rounded-lg shadow-xl p-2">
          <div className="flex flex-col gap-1">
            {Object.entries(COLOR_PALETTES).map(([key, pal]) => (
              <div key={key} className="flex gap-1">
                {pal.shades.map((sc, si) => {
                  const selected = level.color === key && level.shade === si;
                  return (
                    <button
                      key={si}
                      type="button"
                      className={`w-5 h-5 rounded-sm ${sc} transition-transform ${
                        selected
                          ? "ring-2 ring-focus ring-offset-1 ring-offset-bg"
                          : "hover:scale-110"
                      }`}
                      onClick={() => {
                        onPick(key, si);
                        setOpen(false);
                      }}
                      aria-label={`${pal.label} shade ${si + 1}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
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
              className="text-[10px] text-fg-subtle absolute"
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
                className="h-[11px] flex items-center text-[10px] text-fg-subtle leading-none"
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
                  const levelObj = (habit.levels || []).find(
                    (l) => l.value === level,
                  ) || { value: level };
                  const shadeClass = levelShadeClass(
                    levelObj,
                    habit.color,
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
                          ? "ring-2 ring-focus ring-offset-1 ring-offset-bg"
                          : ""
                      } ${isToday && !isSelected ? "ring-1 ring-edge-strong" : ""} hover:ring-2 hover:ring-focus hover:ring-offset-1 hover:ring-offset-bg`}
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
          <span className="text-[10px] text-fg-subtle mr-1">
            Less
          </span>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-surface-2" />
          {(habit.levels || [])
            .sort((a, b) => a.value - b.value)
            .map((l, i) => (
              <div
                key={i}
                className={`w-[11px] h-[11px] rounded-[2px] ${levelShadeClass(l, habit.color, maxLevel)}`}
                title={l.label}
              />
            ))}
          <span className="text-[10px] text-fg-subtle ml-1">
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
      className="absolute z-40 bg-surface border border-edge rounded-xl shadow-xl p-3 min-w-[180px]"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <div className="text-xs font-medium text-fg-subtle mb-2">
        {date}
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            currentLevel === 0
              ? "bg-surface-2 font-medium"
              : "hover:bg-surface-hover"
          }`}
          onClick={() => {
            onSetLevel(habit._id, date, 0);
            onClose();
          }}
        >
          <div className="w-3 h-3 rounded-sm bg-surface-2 border border-edge" />
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
                  ? "bg-surface-2 font-medium"
                  : "hover:bg-surface-hover"
              }`}
              onClick={() => {
                onSetLevel(habit._id, date, l.value);
                onClose();
              }}
            >
              <div
                className={`w-3 h-3 rounded-sm ${levelShadeClass(l, habit.color, maxLevel)}`}
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
    setLevels((prev) => {
      const frozen = freezeLevelColors(prev, color);
      const nextValue = prev.length
        ? Math.max(...prev.map((l) => l.value)) + 1
        : 1;
      const shades = getPalette(color).shades;
      return [
        ...frozen,
        { label: "", value: nextValue, color, shade: shades.length - 1 },
      ];
    });
  };
  const removeLevel = (idx) =>
    setLevels((prev) =>
      freezeLevelColors(prev, color).filter((_, i) => i !== idx),
    );
  const updateLevel = (idx, field, val) =>
    setLevels((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)),
    );
  const setLevelColor = (idx, colorKey, shade) =>
    setLevels((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, color: colorKey, shade } : l,
      ),
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
        ...(l.color && typeof l.shade === "number"
          ? { color: l.color, shade: l.shade }
          : {}),
      })),
    });
  };

  return (
    <motion.div
      className="mt-3 bg-surface-2 border border-edge rounded-xl p-4"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Habit name (e.g. Running)"
          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <div>
          <div className="text-xs text-fg-subtle mb-1.5">
            Color
          </div>
          <div className="flex gap-2">
            {Object.entries(COLOR_PALETTES).map(([key, pal]) => (
              <button
                key={key}
                type="button"
                className={`w-6 h-6 rounded-full ${pal.swatch} transition-transform ${
                  color === key
                    ? "ring-2 ring-offset-2 ring-focus ring-offset-bg scale-110"
                    : "hover:scale-110"
                }`}
                onClick={() => setColor(key)}
                aria-label={pal.label}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-fg-subtle mb-1.5">
            Intensity Levels
          </div>
          <div className="space-y-1.5">
            {levels.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <LevelColorPicker
                  level={l}
                  fallbackColor={color}
                  maxLevel={Math.max(...levels.map((x) => x.value), 1)}
                  onPick={(c, s) => setLevelColor(i, c, s)}
                />
                <input
                  value={l.label}
                  onChange={(e) => updateLevel(i, "label", e.target.value)}
                  placeholder={`Level ${i + 1} label`}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-xs outline-none"
                />
                {levels.length > 1 ? (
                  <button
                    type="button"
                    className="text-fg-subtle hover:text-danger p-0.5"
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
              className="mt-1.5 text-xs text-primary hover:text-primary-hover"
              onClick={addLevel}
            >
              + Add level
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium"
            onClick={handleSubmit}
          >
            Create
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-edge text-sm hover:bg-surface-hover"
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
    (habit.levels || []).map((l) => ({
      label: l.label,
      value: l.value,
      color: l.color,
      shade: l.shade,
    })),
  );

  const addLevel = () => {
    if (levels.length >= 10) return;
    setLevels((prev) => {
      const frozen = freezeLevelColors(prev, color);
      const nextValue = prev.length
        ? Math.max(...prev.map((l) => l.value)) + 1
        : 1;
      const shades = getPalette(color).shades;
      return [
        ...frozen,
        { label: "", value: nextValue, color, shade: shades.length - 1 },
      ];
    });
  };
  const removeLevel = (idx) =>
    setLevels((prev) =>
      freezeLevelColors(prev, color).filter((_, i) => i !== idx),
    );
  const updateLevel = (idx, field, val) =>
    setLevels((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)),
    );
  const setLevelColor = (idx, colorKey, shade) =>
    setLevels((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, color: colorKey, shade } : l,
      ),
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
        ...(l.color && typeof l.shade === "number"
          ? { color: l.color, shade: l.shade }
          : {}),
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
        className="bg-surface border border-edge rounded-2xl shadow-2xl p-6 w-[90vw] max-w-md max-h-[85vh] overflow-y-auto"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-fg mb-4">
          Edit Habit
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-fg-subtle mb-1 block">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-fg-subtle mb-1.5 block">
              Color
            </label>
            <div className="flex gap-2">
              {Object.entries(COLOR_PALETTES).map(([key, pal]) => (
                <button
                  key={key}
                  type="button"
                  className={`w-6 h-6 rounded-full ${pal.swatch} transition-transform ${
                    color === key
                      ? "ring-2 ring-offset-2 ring-focus ring-offset-bg scale-110"
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
              <div className="text-sm font-medium text-fg-muted">
                Inverted habit
              </div>
              <div className="text-xs text-fg-subtle">
                Auto-marked daily. Remove if you didn&apos;t do it.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={inverted}
              onClick={() => setInverted((v) => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${inverted ? "bg-primary" : "bg-edge"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${inverted ? "translate-x-4" : ""}`}
              />
            </button>
          </div>
          <div>
            <label className="text-xs text-fg-subtle mb-1.5 block">
              Intensity Levels
            </label>
            <div className="space-y-1.5">
              {levels.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <LevelColorPicker
                    level={l}
                    fallbackColor={color}
                    maxLevel={Math.max(...levels.map((x) => x.value), 1)}
                    onPick={(c, s) => setLevelColor(i, c, s)}
                  />
                  <input
                    value={l.label}
                    onChange={(e) => updateLevel(i, "label", e.target.value)}
                    placeholder={`Level ${i + 1} label`}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-xs outline-none"
                  />
                  {levels.length > 1 ? (
                    <button
                      type="button"
                      className="text-fg-subtle hover:text-danger p-0.5"
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
                className="mt-1.5 text-xs text-primary hover:text-primary-hover"
                onClick={addLevel}
              >
                + Add level
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              className="flex-1 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg border border-edge text-sm hover:bg-surface-hover"
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

function EditWeekModal({ weekPlan, projects, onSave, onCancel }) {
  const [selectedProjects, setSelectedProjects] = useState(
    (weekPlan.projects || []).map(String),
  );

  const toggleProject = (pid) =>
    setSelectedProjects((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid],
    );

  const handleSubmit = () => {
    onSave({ projects: selectedProjects });
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
        className="bg-surface border border-edge rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-fg mb-1">
          {weekLabel(weekPlan.weekStart)}
        </h3>
        <p className="text-xs text-fg-subtle mb-4">
          Choose which projects appear in this week.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-fg-subtle mb-1 block">
              Projects
            </label>
            <div className="space-y-1 max-h-[220px] overflow-y-auto">
              {projects.map((p) => (
                <label
                  key={p._id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover cursor-pointer text-sm"
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
                <div className="text-xs text-fg-subtle px-2">No projects</div>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="flex-1 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm font-medium"
              onClick={handleSubmit}
            >
              Save
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg border border-edge text-sm hover:bg-surface-hover"
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
  { key: "calendar", label: "Calendar" },
  { key: "schedule", label: "Schedule" },
  { key: "habits", label: "Habits" },
  { key: "routines", label: "Routines" },
];
const DEFAULT_TAB = "tasks";

const TASK_VIEWS = [
  { key: "board", label: "Board", hint: "Every project as a column" },
  { key: "project", label: "Project", hint: "One project: milestones and tasks" },
  { key: "timeline", label: "Timeline", hint: "Projects, milestones and tasks on a time axis" },
];
const DEFAULT_TASK_VIEW = "board";

function PlannerTabs({ active, onChange }) {
  return (
    <div className="px-4 pt-3 pb-3 flex md:justify-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex shrink-0 gap-1 p-1 rounded-xl bg-surface border border-edge">
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-soft text-primary"
                  : "text-fg-muted hover:bg-surface-hover"
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
  const activeTab = TABS.some((t) => t.key === tabParam)
    ? tabParam
    : DEFAULT_TAB;

  const setTab = useCallback(
    (key) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", key);
      router.replace(`/planner?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Tasks tab views: board (the original columns), project (one project:
  // info → milestones → tasks) and timeline (one row per project on a time
  // axis). Kept in ?view= and ?project=.
  const viewParam = searchParams.get("view");
  const tasksView = TASK_VIEWS.some((v) => v.key === viewParam)
    ? viewParam
    : DEFAULT_TASK_VIEW;
  const selectedProjectId = searchParams.get("project");
  const setTasksView = useCallback(
    (view, projectId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "tasks");
      params.set("view", view);
      if (projectId !== undefined) {
        if (projectId) params.set("project", String(projectId));
        else params.delete("project");
      }
      router.replace(`/planner?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [user, setUser] = useState(null);
  const mountedRef = useRef(true);
  // Track first successful fetch so we can distinguish "not loaded" from "empty".
  const projectsLoadedRef = useRef(false);
  const weekPlansLoadedRef = useRef(false);
  const autoWeekCreatedRef = useRef(false);

  // ── shared: projects (used by tasks + schedule) ──────
  const [projects, setProjects] = useState([]);

  // ── tasks state ───────────────────────────────────────
  const [tasks, setTasks] = useState([]);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [milestones, setMilestones] = useState([]);
  // Root-mounted dialogs: the project "⋮" modal, the creation flow and the
  // AI suggestion dialog opened from the project page.
  const [manage, setManage] = useState(null); // { project, tab }
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [suggest, setSuggest] = useState(null); // { kind, project, milestone }

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
  const [editingWeekPlan, setEditingWeekPlan] = useState(null);
  // Phone drawer with planner sections + weeks (calendar tab).
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
      if (mountedRef.current) {
        setProjects(data);
        projectsLoadedRef.current = true;
      }
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

  const refreshMilestones = useCallback(async () => {
    try {
      const data = await apiJson("/api/project-milestones");
      if (mountedRef.current) setMilestones(data);
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
      if (mountedRef.current) {
        setWeekPlans(data);
        weekPlansLoadedRef.current = true;
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // initial load — fetch everything at mount
  useEffect(() => {
    mountedRef.current = true;
    refreshProjects();
    refreshTasks();
    refreshMilestones();
    refreshHabits();
    refreshWeekPlans();
    return () => {
      mountedRef.current = false;
    };
  }, [
    refreshProjects,
    refreshTasks,
    refreshMilestones,
    refreshHabits,
    refreshWeekPlans,
  ]);

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

  // Auto-select a week plan: the current week when it exists, else the latest.
  // Desktop always; on phones only when the calendar opens (once), so the
  // "Back to list" flow in the schedule tab keeps working.
  const weekAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (selectedWeekPlanId || !weekPlans.length) return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (!isDesktop && (activeTab !== "calendar" || weekAutoSelectedRef.current))
      return;
    weekAutoSelectedRef.current = true;
    const monday = getMondayOf(new Date());
    const current = weekPlans.find((wp) => wp.weekStart === monday);
    setSelectedWeekPlanId((current || weekPlans[0])._id);
  }, [weekPlans, selectedWeekPlanId, activeTab]);

  // Close the phone drawer once the user picked a week or a section.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [selectedWeekPlanId, activeTab]);

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

  const milestonesByProject = useMemo(() => {
    const map = new Map();
    for (const m of milestones) {
      const pid = idOf(m.project);
      const list = map.get(pid) || [];
      list.push(m);
      map.set(pid, list);
    }
    for (const [k, list] of map.entries()) {
      map.set(k, [...list].sort(compareMilestones));
    }
    return map;
  }, [milestones]);

  /** Add reviewed milestones/tasks to a project (one request). Throws on error. */
  const addStructure = useCallback(async (projectId, payload) => {
    const data = await apiJson("/api/projects/structure", {
      method: "POST",
      body: JSON.stringify({ projectId, ...payload }),
    });
    if (mountedRef.current) {
      if (data.milestones?.length)
        setMilestones((prev) => [...prev, ...data.milestones]);
      if (data.tasks?.length) setTasks((prev) => [...prev, ...data.tasks]);
    }
    return data;
  }, []);

  /** Creation flow: project first, then the reviewed structure. Throws on error. */
  const createProject = useCallback(
    async ({
      name,
      description,
      headerColor,
      template,
      startDate,
      endDate,
      milestones: structure,
    }) => {
      const created = await apiJson("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          ...(description ? { description } : {}),
          ...(template ? { template } : {}),
          ...(headerColor ? { headerColor } : {}),
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        }),
      });
      if (mountedRef.current) setProjects((prev) => [...prev, created]);
      if (structure?.length) {
        await addStructure(created._id, { milestones: structure });
      }
      return created;
    },
    [addStructure],
  );

  const updateProject = useCallback(async (project, patch) => {
    if (mountedRef.current) {
      setProjects((prev) =>
        prev.map((p) =>
          String(p._id) === String(project._id) ? { ...p, ...patch } : p,
        ),
      );
    }
    try {
      const updated = await apiJson("/api/projects", {
        method: "PATCH",
        body: JSON.stringify({ id: project._id, ...patch }),
      });
      if (mountedRef.current)
        setProjects((prev) =>
          prev.map((p) =>
            String(p._id) === String(updated._id) ? updated : p,
          ),
        );
    } catch (e) {
      console.error(e);
      refreshProjects();
    }
  }, [refreshProjects]);

  const addTask = useCallback(
    async (project, title, scheduledDate, milestoneId = null) => {
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
            ...(milestoneId ? { milestoneId: String(milestoneId) } : {}),
            ...(normalized ? { scheduledDate: normalized } : {}),
            ...(scheduledForLater ? { scheduledForLater: true } : {}),
          }),
        });
        if (mountedRef.current) setTasks((prev) => [...prev, created]);
      } catch (e) {
        console.error(e);
      }
    },
    [],
  );

  const renameTask = useCallback(async (task, title) => {
    try {
      const updated = await apiJson("/api/tasks", {
        method: "PATCH",
        body: JSON.stringify({ id: task._id, title }),
      });
      if (mountedRef.current)
        setTasks((prev) =>
          prev.map((t) => (t._id === updated._id ? updated : t)),
        );
    } catch (e) {
      console.error(e);
    }
  }, []);

  /** Move a task (and its subtasks) to a milestone, or to "Unassigned" (null). */
  const setTaskMilestone = useCallback(
    async (task, milestoneId) => {
      const next = milestoneId ? String(milestoneId) : null;
      if ((idOf(task.milestone) || null) === next) return;
      const taskId = String(task._id);
      if (mountedRef.current) {
        setTasks((prev) =>
          prev.map((t) =>
            String(t._id) === taskId || idOf(t.parentTask) === taskId
              ? { ...t, milestone: next }
              : t,
          ),
        );
      }
      try {
        await apiJson("/api/tasks", {
          method: "PATCH",
          body: JSON.stringify({ id: task._id, milestoneId: next }),
        });
      } catch (e) {
        console.error(e);
        refreshTasks();
      }
    },
    [refreshTasks],
  );

  /* ── milestone callbacks ───────────────────────────── */

  const createMilestone = useCallback(async (projectId, data) => {
    const created = await apiJson("/api/project-milestones", {
      method: "POST",
      body: JSON.stringify({ projectId: String(projectId), ...data }),
    });
    if (mountedRef.current) setMilestones((prev) => [...prev, created]);
    return created;
  }, []);

  const updateMilestone = useCallback(
    async (milestone, patch) => {
      const optimistic = { ...patch };
      if (patch.status === "completed") optimistic.completedAt = new Date().toISOString();
      else if (patch.status) optimistic.completedAt = null;
      if (mountedRef.current) {
        setMilestones((prev) =>
          prev.map((m) =>
            String(m._id) === String(milestone._id) ? { ...m, ...optimistic } : m,
          ),
        );
      }
      try {
        const updated = await apiJson("/api/project-milestones", {
          method: "PATCH",
          body: JSON.stringify({ id: milestone._id, ...patch }),
        });
        if (mountedRef.current)
          setMilestones((prev) =>
            prev.map((m) => (String(m._id) === String(updated._id) ? updated : m)),
          );
      } catch (e) {
        console.error(e);
        refreshMilestones();
      }
    },
    [refreshMilestones],
  );

  const deleteMilestone = useCallback(
    async (milestone) => {
      const ok = window.confirm(
        `Delete milestone "${milestone.name}"? Its tasks are kept and become unassigned.`,
      );
      if (!ok) return false;
      try {
        await apiJson("/api/project-milestones", {
          method: "DELETE",
          body: JSON.stringify({ id: milestone._id }),
        });
        if (mountedRef.current) {
          const mid = String(milestone._id);
          setMilestones((prev) => prev.filter((m) => String(m._id) !== mid));
          setTasks((prev) =>
            prev.map((t) => (idOf(t.milestone) === mid ? { ...t, milestone: null } : t)),
          );
        }
        return true;
      } catch (e) {
        console.error(e);
        refreshMilestones();
        return false;
      }
    },
    [refreshMilestones],
  );

  const reorderMilestones = useCallback(
    async (projectId, orderedIds) => {
      const orderById = new Map(orderedIds.map((id, i) => [String(id), i]));
      if (mountedRef.current) {
        setMilestones((prev) =>
          prev.map((m) =>
            orderById.has(String(m._id)) ? { ...m, order: orderById.get(String(m._id)) } : m,
          ),
        );
      }
      try {
        await apiJson("/api/project-milestones/reorder", {
          method: "PATCH",
          body: JSON.stringify({ projectId: String(projectId), orderedIds }),
        });
      } catch (e) {
        console.error(e);
        refreshMilestones();
      }
    },
    [refreshMilestones],
  );

  const toggleMilestoneComplete = useCallback(
    (milestone) =>
      updateMilestone(milestone, {
        status: milestone.status === "completed" ? "active" : "completed",
      }),
    [updateMilestone],
  );

  const openManage = useCallback((project, tab = "project") => {
    setManage({ project, tab });
  }, []);

  const openProjectPage = useCallback(
    (project) => setTasksView("project", project?._id || null),
    [setTasksView],
  );

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

  /** Planned span of a task ({ startDate, endDate } as "YYYY-MM-DD" or null). */
  const setTaskDates = useCallback(
    async (task, { startDate, endDate }) => {
      const patch = {
        startDate: startDate || null,
        endDate: endDate || null,
      };
      if (mountedRef.current) {
        setTasks((prev) =>
          prev.map((t) => (t._id === task._id ? { ...t, ...patch } : t)),
        );
      }
      try {
        const updated = await apiJson("/api/tasks", {
          method: "PATCH",
          body: JSON.stringify({ id: task._id, ...patch }),
        });
        if (mountedRef.current)
          setTasks((prev) =>
            prev.map((t) => (t._id === updated._id ? updated : t)),
          );
      } catch (e) {
        console.error(e);
        refreshTasks();
      }
    },
    [refreshTasks],
  );

  const deleteProject = useCallback(async (project) => {
    const ok = window.confirm(
      `Delete project "${project.name}"? Its milestones and tasks are deleted too.`,
    );
    if (!ok) return false;
    try {
      await apiJson("/api/projects", {
        method: "DELETE",
        body: JSON.stringify({ id: project._id }),
      });
      if (mountedRef.current) {
        const pid = String(project._id);
        setProjects((prev) => prev.filter((p) => String(p._id) !== pid));
        setTasks((prev) => prev.filter((t) => String(t.project) !== pid));
        setMilestones((prev) => prev.filter((m) => idOf(m.project) !== pid));
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
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
            ...(isMoved && fromProjectId !== targetProjectId
              ? { milestoneId: null }
              : {}),
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
        if (Object.prototype.hasOwnProperty.call(u, "milestoneId"))
          updated.milestone = u.milestoneId;
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
      }
      return created;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, []);

  // Create the next not-yet-added week: the Monday after the latest existing
  // week (or the current week's Monday if none), named by its ISO week number,
  // pre-filled with all projects.
  const addWeek = useCallback(() => {
    const latest = weekPlans[0]?.weekStart; // API sorts weekStart desc
    let monday;
    if (latest) {
      const d = new Date(`${latest}T00:00:00`);
      d.setDate(d.getDate() + 7);
      monday = getMondayOf(d);
    } else {
      monday = getMondayOf(new Date());
    }
    if (weekPlans.some((wp) => wp.weekStart === monday)) {
      const existing = weekPlans.find((wp) => wp.weekStart === monday);
      setSelectedWeekPlanId(existing._id);
      return;
    }
    createWeekPlan({
      name: weekLabel(monday),
      weekStart: monday,
      projects: projects.map((p) => p._id),
    });
  }, [weekPlans, projects, createWeekPlan]);

  // Auto-create the current week on load if it doesn't exist yet.
  useEffect(() => {
    if (autoWeekCreatedRef.current) return;
    if (!weekPlansLoadedRef.current || !projectsLoadedRef.current) return;
    const monday = getMondayOf(new Date());
    if (weekPlans.some((wp) => wp.weekStart === monday)) {
      autoWeekCreatedRef.current = true;
      return;
    }
    autoWeekCreatedRef.current = true;
    createWeekPlan({
      name: weekLabel(monday),
      weekStart: monday,
      projects: projects.map((p) => p._id),
    });
  }, [weekPlans, projects, createWeekPlan]);

  const deleteWeekPlan = useCallback(
    async (plan) => {
      const ok = window.confirm(`Delete "${weekLabel(plan.weekStart)}"?`);
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
                  startMinute: data.startMinute ?? null,
                  durationMinutes: data.durationMinutes ?? null,
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
    async ({
      taskId,
      fromDayOfWeek,
      toDayOfWeek,
      toProjectId,
      startMinute,
      durationMinutes,
    }) => {
      if (!selectedWeekPlanId) return;
      if (typeof taskId !== "string" || taskId.startsWith("temp_")) return;
      // Calendar placement is only changed when explicitly provided.
      const timing = {
        ...(startMinute !== undefined ? { startMinute } : {}),
        ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      };
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
                  ...timing,
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
            ...timing,
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
    <div className="bg-surface border border-edge rounded-2xl shadow-sm p-3">
      <button
        type="button"
        className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-surface-hover"
        onClick={() => setProjectsOpen((v) => !v)}
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
                const isSelected =
                  tasksView === "project" &&
                  String(p._id) === String(selectedProjectId);
                return (
                  <div
                    key={p._id}
                    className={`group flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-lg text-sm ${
                      isSelected
                        ? "bg-primary-soft text-primary"
                        : "text-fg-muted hover:bg-surface-hover"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${colorMeta.swatchClass}`}
                    />
                    <button
                      type="button"
                      className="flex-1 min-w-0 truncate text-left py-0.5"
                      onClick={() => openProjectPage(p)}
                      title="Open project page"
                    >
                      {p.name}
                    </button>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-fg-subtle hover:text-fg p-1"
                      aria-label="Project menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        openManage(p, "project");
                      }}
                    >
                      <IconDotsVertical className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {!projects.length ? (
                <div className="px-3 py-2 text-sm text-fg-subtle">
                  No projects yet
                </div>
              ) : null}
            </div>

            <div className="mt-3">
              <button
                type="button"
                className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm font-medium hover:bg-surface-hover"
                onClick={() => setNewProjectOpen(true)}
              >
                + Create new project
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  const renderHabitsSidebar = () => (
    <div className="bg-surface border border-edge rounded-2xl shadow-sm p-3 overflow-hidden">
      <div className="px-2 py-2 font-semibold text-fg">
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
                  ? "bg-primary-soft text-primary font-medium"
                  : "text-fg-muted hover:bg-surface-hover"
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
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-fg-subtle hover:text-danger p-0.5"
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
          <div className="px-3 py-2 text-sm text-fg-subtle">
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
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm font-medium hover:bg-surface-hover transition-colors"
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
    <div className="bg-surface border border-edge rounded-2xl shadow-sm p-3 overflow-hidden">
      <div className="px-2 py-2 font-semibold text-fg">
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
                  ? "bg-primary-soft text-primary font-medium"
                  : "text-fg-muted hover:bg-surface-hover"
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
          <div className="px-3 py-2 text-sm text-fg-subtle">
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
            className="md:hidden mb-3 flex items-center gap-1 text-sm text-primary"
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
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left bg-surface-2 border border-edge hover:bg-surface-hover transition-colors"
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
              <div className="text-fg-muted px-2 py-4">
                Create a project in the Tasks tab first.
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedRoutineProjectId ? (
          <>
            {proj ? (
              <h2 className="text-lg font-semibold text-fg mb-4">
                {proj.name}
              </h2>
            ) : null}
            <RoutineTasksView
              key={selectedRoutineProjectId}
              projectId={selectedRoutineProjectId}
            />
          </>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-fg-subtle">
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
    <div className="bg-surface border border-edge rounded-2xl shadow-sm p-3 overflow-hidden">
      <div className="px-2 py-2 font-semibold text-fg">
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
                  ? "bg-primary-soft text-primary font-medium"
                  : "text-fg-muted hover:bg-surface-hover"
              }`}
              onClick={() => setSelectedWeekPlanId(wp._id)}
            >
              <div className="w-3 h-3 rounded-full shrink-0 bg-primary" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{weekLabel(wp.weekStart)}</div>
                <div className="text-[10px] text-fg-subtle">
                  {fmt(start)} – {fmt(end)}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-fg-subtle hover:text-danger p-0.5"
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
        {!weekPlans.length ? (
          <div className="px-3 py-2 text-sm text-fg-subtle">
            No weekly routines yet
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm font-medium hover:bg-surface-hover transition-colors"
        onClick={addWeek}
      >
        <IconPlus className="w-4 h-4" />
        Add Week
      </button>
    </div>
  );

  /* ╔════════════════════════════════════════════════════╗
     ║  Main renderers (per tab)                          ║
     ╚════════════════════════════════════════════════════╝ */

  const selectedProject = useMemo(
    () =>
      selectedProjectId
        ? projects.find((p) => String(p._id) === String(selectedProjectId)) || null
        : null,
    [projects, selectedProjectId],
  );

  const taskHandlers = {
    onToggleTask: toggleTask,
    onCreateSubtask: createSubtask,
    onDeleteTask: deleteTask,
    onMoveTask: moveTask,
    onSetScheduledDate: setTaskScheduledDate,
    onSetTaskDates: setTaskDates,
    onSetTaskMilestone: setTaskMilestone,
    onRenameTask: renameTask,
    onDropTask: (taskId, milestoneId) => {
      const task = tasksRef.current.find((t) => String(t._id) === String(taskId));
      if (task && !task.parentTask) setTaskMilestone(task, milestoneId);
    },
  };

  const renderTasksViewSwitcher = () => (
    <div className="flex items-center gap-2 px-4 pt-3 md:pr-8">
      <div
        className="inline-flex gap-0.5 p-0.5 rounded-lg bg-surface border border-edge"
        role="tablist"
        aria-label="Tasks view"
      >
        {TASK_VIEWS.map((v) => {
          const isActive = tasksView === v.key;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              title={v.hint}
              onClick={() =>
                setTasksView(
                  v.key,
                  v.key === "project" && !selectedProjectId && projects.length === 1
                    ? projects[0]._id
                    : undefined,
                )
              }
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary-soft text-primary"
                  : "text-fg-muted hover:bg-surface-hover"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>
      {tasksView === "project" && selectedProject ? (
        <select
          value={String(selectedProject._id)}
          onChange={(e) => setTasksView("project", e.target.value)}
          className="ml-auto md:hidden max-w-[45%] px-2 py-1 rounded-md bg-surface border border-edge text-xs text-fg outline-none"
          aria-label="Project"
        >
          {projects.map((p) => (
            <option key={p._id} value={String(p._id)}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="button"
        className="ml-auto md:hidden shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md bg-primary text-primary-fg text-xs font-medium"
        onClick={() => setNewProjectOpen(true)}
      >
        + Project
      </button>
    </div>
  );

  const renderTasksMain = () => (
    <div className="h-full flex flex-col">
      {renderTasksViewSwitcher()}
      <div className="flex-1 min-h-0">
        {tasksView === "board" ? (
          <div className="h-full overflow-y-auto">
            <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-start gap-4 p-4 md:pr-8">
              {projects.map((p) => (
                <ProjectColumn
                  key={p._id}
                  project={p}
                  tasks={tasksByProject.get(String(p._id)) || []}
                  milestones={milestonesByProject.get(String(p._id)) || []}
                  onAddTask={addTask}
                  onToggleTask={toggleTask}
                  onCreateSubtask={createSubtask}
                  onDeleteTask={deleteTask}
                  onManage={openManage}
                  onMoveTask={moveTask}
                  onSetScheduledDate={setTaskScheduledDate}
                  onSetDates={setTaskDates}
                  onSetTaskMilestone={setTaskMilestone}
                  onRenameTask={renameTask}
                  onToggleMilestone={toggleMilestoneComplete}
                  onOpenMilestone={(project) => openProjectPage(project)}
                />
              ))}

              {!projects.length ? (
                <div className="text-fg-muted px-4 py-4">
                  Create a project to start adding tasks.
                </div>
              ) : null}
            </div>
          </div>
        ) : tasksView === "timeline" ? (
          <TimelineView
            projects={projects}
            milestones={milestones}
            tasks={tasks}
            onOpenProject={openProjectPage}
            onOpenMilestone={(project) => project && openProjectPage(project)}
            onManageProject={(project, tab = "project") => openManage(project, tab)}
          />
        ) : (
          <ProjectPageView
            project={selectedProject}
            projects={projects}
            milestones={
              selectedProject
                ? milestonesByProject.get(String(selectedProject._id)) || []
                : []
            }
            tasks={
              selectedProject
                ? tasksByProject.get(String(selectedProject._id)) || []
                : []
            }
            handlers={taskHandlers}
            onSelectProject={openProjectPage}
            onManage={(tab) => selectedProject && openManage(selectedProject, tab)}
            onSuggestMilestones={() =>
              selectedProject &&
              setSuggest({ kind: "milestones", project: selectedProject })
            }
            onSuggestTasks={(milestone) =>
              selectedProject &&
              setSuggest({ kind: "tasks", project: selectedProject, milestone })
            }
            onAddTask={addTask}
            onUpdateMilestone={updateMilestone}
          />
        )}
      </div>
    </div>
  );

  const renderHabitsMain = () => (
    <div className="h-full overflow-auto p-4 md:p-6">
      {/* Mobile: list when none selected */}
      {!selectedHabitId ? (
        <div className="md:hidden">
          <div className="bg-surface border border-edge rounded-2xl shadow-sm p-3">
            <div className="px-2 py-2 font-semibold text-fg">
              Habits
            </div>
            <div className="space-y-1 mt-1">
              {habits.map((h) => {
                const palette = getPalette(h.color);
                return (
                  <div
                    key={h._id}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors text-fg-muted hover:bg-surface-hover"
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
                      className="w-4 h-4 text-fg-subtle"
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
                <div className="px-3 py-2 text-sm text-fg-subtle">
                  No habits yet
                </div>
              ) : null}
            </div>
            {!creatingHabit ? (
              <button
                type="button"
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm font-medium hover:bg-surface-hover transition-colors"
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
                className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-surface-hover transition-colors"
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
                  <h2 className="text-xl font-bold text-fg">
                    {selectedHabit.name}
                  </h2>
                  <button
                    type="button"
                    className="p-1 rounded-md hover:bg-surface-hover text-fg-subtle hover:text-fg-muted transition-colors"
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-soft text-primary font-medium">
                      inverted
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-fg-subtle mt-0.5">
                  {totalTracked} day{totalTracked !== 1 ? "s" : ""} tracked in{" "}
                  {year}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-2 py-1 rounded-lg border border-edge text-sm hover:bg-surface-hover"
                onClick={() => setYear((y) => y - 1)}
              >
                &larr;
              </button>
              <span className="text-sm font-semibold min-w-[3rem] text-center">
                {year}
              </span>
              <button
                type="button"
                className="px-2 py-1 rounded-lg border border-edge text-sm hover:bg-surface-hover"
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
                className="w-3.5 h-3.5 text-fg-subtle shrink-0"
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
              <span className="text-[11px] text-fg-subtle">
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
            <h3 className="text-sm font-semibold text-fg-muted mb-2">
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
                        className={`w-4 h-4 rounded-sm ${levelShadeClass(l, selectedHabit.color, maxLvl)}`}
                      />
                      <span className="text-xs text-fg-muted">
                        {l.label}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-col items-center justify-center h-full text-fg-subtle">
          <p className="text-lg">
            {habits.length
              ? "Select a habit to view its tracker"
              : "Create a habit to get started"}
          </p>
        </div>
      )}
    </div>
  );

  // Calendar tab: the tab strip is hidden, so the sidebar carries the
  // section navigation above the week list.
  const renderSectionNav = () => (
    <nav
      className="bg-surface border border-edge rounded-2xl shadow-sm p-2 space-y-0.5"
      aria-label="Planner sections"
    >
      {TABS.map((t) => {
        const isActive = activeTab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={isActive ? "page" : undefined}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-soft text-primary"
                : "text-fg-muted hover:bg-surface-hover hover:text-fg"
            }`}
          >
            {t.label}
            {isActive ? (
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );

  const renderCalendarSidebar = () => (
    <div className="space-y-3">
      {renderSectionNav()}
      {renderScheduleSidebar()}
    </div>
  );

  const renderScheduleMain = (view = "list") => (
    <div
      className={
        view === "calendar"
          ? "h-full flex flex-col p-2 md:p-3"
          : "h-full overflow-auto p-4 md:p-6"
      }
    >
      {/* Mobile: list when none selected */}
      {!selectedWeekPlanId ? (
        <div className="md:hidden">
          <div className="bg-surface border border-edge rounded-2xl shadow-sm p-3">
            <div className="px-2 py-2 font-semibold text-fg">
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
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors text-fg-muted hover:bg-surface-hover"
                    onClick={() => setSelectedWeekPlanId(wp._id)}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0 bg-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{weekLabel(wp.weekStart)}</div>
                      <div className="text-[10px] text-fg-subtle">
                        {fmt(start)} – {fmt(end)}
                      </div>
                    </div>
                    <svg
                      className="w-4 h-4 text-fg-subtle"
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
              {!weekPlans.length ? (
                <div className="px-3 py-2 text-sm text-fg-subtle">
                  No weekly routines yet
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm font-medium hover:bg-surface-hover transition-colors"
              onClick={addWeek}
            >
              <IconPlus className="w-4 h-4" />
              Add Week
            </button>
          </div>
        </div>
      ) : null}

      {selectedWeekPlan ? (
        <div className={view === "calendar" ? "flex-1 min-h-0 flex flex-col" : ""}>
          {view !== "calendar" ? (
            <button
              type="button"
              className="md:hidden flex items-center gap-1 mb-4 p-1.5 -ml-1.5 rounded-lg hover:bg-surface-hover transition-colors text-sm text-fg-muted"
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
          ) : null}
          <WeeklyRoutine
            view={view}
            onOpenSidebar={
              view === "calendar" ? () => setMobileSidebarOpen(true) : undefined
            }
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
        <div className="hidden md:flex flex-col items-center justify-center h-full text-fg-subtle">
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

  // Calendar and Schedule share the week-plan sidebar.
  const sidebar =
    activeTab === "tasks"
      ? renderTasksSidebar()
      : activeTab === "routines"
        ? renderRoutinesSidebar()
        : activeTab === "habits"
          ? renderHabitsSidebar()
          : activeTab === "calendar"
            ? renderCalendarSidebar()
            : renderScheduleSidebar();

  const main =
    activeTab === "tasks"
      ? renderTasksMain()
      : activeTab === "routines"
        ? renderRoutinesMain()
        : activeTab === "habits"
          ? renderHabitsMain()
          : activeTab === "calendar"
            ? renderScheduleMain("calendar")
            : renderScheduleMain("list");

  return (
    <div className="w-screen min-h-screen transition-colors duration-300">
      <Navbar user={user} onLogout={handleLogout} />

      {/* The calendar hides the tab strip (it moves into the sidebar) to give
          the hour grid as much height as possible. */}
      {activeTab !== "calendar" ? (
        <PlannerTabs active={activeTab} onChange={setTab} />
      ) : null}

      <div
        className={`w-full flex flex-col md:flex-row md:px-6 ${
          activeTab === "calendar"
            ? "h-[calc(100vh-10rem)] md:h-[calc(100vh-5.5rem)] pt-1"
            : "h-[calc(100vh-13rem)] md:h-[calc(100vh-7.75rem)]"
        }`}
      >
        {/* Sidebar (desktop only) */}
        {sidebar ? (
          <div className="hidden md:block md:static md:w-[280px] md:pt-0 md:bg-transparent md:shadow-none h-full px-4 pb-4 overflow-y-auto">
            {sidebar}
          </div>
        ) : null}

        {/* Main */}
        <div
          className={`flex-1 h-full px-2 md:px-0 md:pr-4 overflow-hidden min-w-0 ${
            activeTab === "calendar" ? "pb-2 md:pb-3" : "pb-4"
          }`}
        >
          <div className="h-full bg-surface/40 border border-edge rounded-2xl overflow-hidden">
            {main}
          </div>
        </div>
      </div>

      {/* Phone drawer: planner sections + week list (calendar tab) */}
      <AnimatePresence>
        {mobileSidebarOpen ? (
          <motion.div
            className="fixed inset-0 z-[60] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileSidebarOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-bg p-3 overflow-y-auto shadow-2xl"
              initial={{ x: -40 }}
              animate={{ x: 0 }}
              exit={{ x: -40 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              role="dialog"
              aria-label="Weeks and sections"
            >
              {renderCalendarSidebar()}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Modals — root-mounted so they survive tab switches */}
      <ProjectManageModal
        open={Boolean(manage)}
        project={
          manage
            ? projects.find((p) => String(p._id) === String(manage.project._id)) ||
              manage.project
            : null
        }
        milestones={manage ? milestonesByProject.get(String(manage.project._id)) || [] : []}
        tasks={manage ? tasksByProject.get(String(manage.project._id)) || [] : []}
        initialTab={manage?.tab || "project"}
        onClose={() => setManage(null)}
        actions={{
          updateProject,
          deleteProject,
          createMilestone,
          updateMilestone,
          deleteMilestone,
          reorderMilestones,
          setTaskMilestone,
          addStructure,
        }}
      />

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreate={async (data) => {
          const created = await createProject(data);
          if (data.milestones?.length) openProjectPage(created);
        }}
      />

      <SuggestDialog
        open={Boolean(suggest)}
        kind={suggest?.kind || "milestones"}
        project={suggest?.project || null}
        milestone={suggest?.milestone || null}
        milestones={milestones}
        tasks={tasks}
        onClose={() => setSuggest(null)}
        onConfirm={(payload) =>
          suggest?.kind === "tasks"
            ? addStructure(suggest.project._id, {
                milestoneId: suggest.milestone?._id || null,
                tasks: payload.tasks,
              })
            : addStructure(suggest.project._id, { milestones: payload.milestones })
        }
      />

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
