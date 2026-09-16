"use client";

// Google-Calendar-style week view for a week plan.
//
// - Hour rows for the whole day; tasks with a `startMinute` render as blocks.
// - Tasks without a time (and auto-scheduled / dated virtuals) sit in the
//   "unscheduled" strip above the grid.
// - Drag a block or strip chip onto an hour to (re)schedule it, or back onto
//   the strip to clear its time. Auto-scheduled routine tasks become real
//   week tasks when dropped on a time.
// - Click-and-drag on empty grid space selects a range, then the add-task
//   popover asks which task goes into that block.
// - Drag a block's bottom edge to change its length.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AddTaskPopover,
  TaskEditPopover,
  TaskColorLines,
  IconCheck,
  IconDotsVertical,
  IconNote,
  IconPlus,
  minutesToTime,
  taskDuration,
} from "./WeekPlanShared";
import { dayShortName, weekDates, weekDayLabels } from "@/utils/timeUtils";
import { useWeekSettings } from "@/hooks/useWeekSettings";

const HOUR_PX = 48; // height of one hour row
const SNAP = 15; // minutes
const DAY_MINUTES = 24 * 60;
const MIN_BLOCK = 15;
const CLICK_BLOCK = 60; // plain click (no drag) selects this many minutes
const INITIAL_SCROLL_HOUR = 7;
const GUTTER_PX = 56;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const snapTo = (m) => Math.round(m / SNAP) * SNAP;
const floorTo = (m) => Math.floor(m / SNAP) * SNAP;
const yToMinute = (y) => (y / HOUR_PX) * 60;
const minuteToY = (m) => (m / 60) * HOUR_PX;

// Auto-scroll while dragging, selecting or resizing near the top or bottom
// edge of the scroll area.
const EDGE_PX = 56; // distance from the edge where scrolling starts
const MAX_SCROLL_STEP = 16; // px per frame right at the edge

/**
 * Scrolls the element returned by `getEl` while the pointer sits within
 * EDGE_PX of its top or bottom edge, faster the closer it gets. `onTick`
 * re-runs the caller's position logic with the last pointer Y each frame,
 * because no new pointer event fires while the content moves under a
 * still pointer (HTML5 drag fires dragover periodically on its own).
 */
function createEdgeScroller(getEl) {
  let raf = 0;
  let speed = 0;
  let lastY = 0;
  let tick = null;
  const loop = () => {
    const el = getEl();
    if (!el || !speed) {
      raf = 0;
      return;
    }
    const before = el.scrollTop;
    el.scrollTop = before + speed;
    if (el.scrollTop !== before && tick) tick(lastY);
    raf = requestAnimationFrame(loop);
  };
  return {
    update(clientY, onTick = null) {
      const el = getEl();
      if (!el) return;
      lastY = clientY;
      tick = onTick;
      const rect = el.getBoundingClientRect();
      let next = 0;
      if (clientY < rect.top + EDGE_PX) {
        next = -Math.ceil(((rect.top + EDGE_PX - clientY) / EDGE_PX) * MAX_SCROLL_STEP);
      } else if (clientY > rect.bottom - EDGE_PX) {
        next = Math.ceil(((clientY - (rect.bottom - EDGE_PX)) / EDGE_PX) * MAX_SCROLL_STEP);
      }
      speed = clamp(next, -MAX_SCROLL_STEP, MAX_SCROLL_STEP);
      if (speed && !raf) raf = requestAnimationFrame(loop);
    },
    stop() {
      speed = 0;
      tick = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

function routineIdOf(task) {
  if (!task?.routineTask) return null;
  return typeof task.routineTask === "object"
    ? String(task.routineTask._id || task.routineTask)
    : String(task.routineTask);
}

// Assign side-by-side lanes to overlapping blocks (like Google Calendar).
function layoutDay(entries) {
  const sorted = [...entries].sort(
    (a, b) => a.start - b.start || b.end - a.end,
  );
  const out = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    const laneEnds = [];
    for (const b of cluster) {
      let lane = laneEnds.findIndex((end) => end <= b.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(b.end);
      } else {
        laneEnds[lane] = b.end;
      }
      b.lane = lane;
    }
    for (const b of cluster) {
      b.lanes = laneEnds.length;
      out.push(b);
    }
    cluster = [];
    clusterEnd = -1;
  };
  for (const b of sorted) {
    if (cluster.length && b.start >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  flush();
  return out;
}

export default function WeekCalendar({
  weekPlan,
  dayTasks = [],
  dayDates = [],
  todayDow,
  routineTasks = [],
  todoTasks = [],
  projectNameMap = {},
  projectColorMap = {},
  taskColorMap = {},
  getTaskProjectId,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onMoveTask,
  // Which day columns to render (0 = Monday). The dashboard shows just today.
  visibleDays = [0, 1, 2, 3, 4, 5, 6],
  compact = false,
}) {
  const scrollRef = useRef(null);
  const colRefs = useRef([]);

  // Day names come from the week's real dates (a plan may start on Monday
  // or Sunday); without a plan yet, from the "week starts on" setting.
  const { settings: weekSettings } = useWeekSettings();
  const dayNames = useMemo(
    () =>
      weekPlan?.weekStart
        ? weekDates(weekPlan.weekStart).map(dayShortName)
        : weekDayLabels(weekSettings.weekStartsOn),
    [weekPlan?.weekStart, weekSettings.weekStartsOn],
  );
  const selectionAnchorRef = useRef(null);
  const addBtnRefs = useRef({});
  const editBtnRefs = useRef({});

  // Drag state lives in a ref (dataTransfer is unreadable during dragover).
  const dragInfoRef = useRef(null);
  const [dragPreview, setDragPreview] = useState(null); // { day, start, duration }
  const [dragOverStrip, setDragOverStrip] = useState(null); // day index

  // Click-and-drag range selection.
  const selRef = useRef(null); // { day, anchor, moved }
  const [selection, setSelection] = useState(null); // { day, start, end, done }

  // Resizing a block from its bottom edge.
  const resizeRef = useRef(null);
  const [resizing, setResizing] = useState(null); // { taskId, duration }

  // Edge auto-scroll shared by drag, range selection and resizing.
  const edgeScrollRef = useRef(null);
  if (!edgeScrollRef.current) {
    edgeScrollRef.current = createEdgeScroller(() => scrollRef.current);
  }
  useEffect(() => () => edgeScrollRef.current?.stop(), []);

  const [addingStripDay, setAddingStripDay] = useState(null);
  const [editingKey, setEditingKey] = useState(null);

  const [nowMinute, setNowMinute] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMinute(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // Start the day view around the morning, like a calendar app.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = minuteToY(INITIAL_SCROLL_HOUR * 60) - 8;
  }, [weekPlan?._id]);

  /* ── Derived per-day data ─────────────────────────────── */

  const timedByDay = useMemo(
    () =>
      Array.from({ length: 7 }, (_, d) => {
        const entries = [];
        // Auto-scheduled routines with a time of day render as (dashed)
        // blocks too; dropping or ticking one materialises it.
        for (const task of dayTasks[d] || []) {
          if (task.startMinute == null) continue;
          const start = clamp(Number(task.startMinute) || 0, 0, DAY_MINUTES - MIN_BLOCK);
          const dur =
            resizing && String(resizing.taskId) === String(task._id)
              ? resizing.duration
              : taskDuration(task);
          const end = clamp(start + dur, start + MIN_BLOCK, DAY_MINUTES);
          entries.push({ task, start, end });
        }
        return layoutDay(entries);
      }),
    [dayTasks, resizing],
  );

  const stripByDay = useMemo(
    () =>
      Array.from({ length: 7 }, (_, d) =>
        (dayTasks[d] || []).filter((t) => t.startMinute == null),
      ),
    [dayTasks],
  );

  const colorsFor = useCallback(
    (task) => {
      const rtId = routineIdOf(task);
      return rtId ? taskColorMap[rtId] : null;
    },
    [taskColorMap],
  );

  const canDrag = (task) =>
    !task.completed && (!task._virtual || (task._virtual && !task._dated));

  /* ── Drag & drop ─────────────────────────────────────── */

  const clearDrag = () => {
    dragInfoRef.current = null;
    edgeScrollRef.current?.stop();
    setDragPreview(null);
    setDragOverStrip(null);
  };

  const handleDragStart = (e, task, fromDay, timed) => {
    if (!canDrag(task)) {
      e.preventDefault();
      return;
    }
    const duration = taskDuration(task);
    let grabOffsetMin = 0;
    if (timed) {
      const rect = e.currentTarget.getBoundingClientRect();
      grabOffsetMin = yToMinute(e.clientY - rect.top);
    }
    dragInfoRef.current = { task, fromDay, duration, grabOffsetMin };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ taskId: String(task._id), fromDayOfWeek: fromDay }),
    );
    e.dataTransfer.setData("text/plain", String(task._id));
  };

  const pointerStart = (e, dayIdx) => {
    const info = dragInfoRef.current;
    const col = colRefs.current[dayIdx];
    if (!info || !col) return null;
    const rect = col.getBoundingClientRect();
    const pointerMin = yToMinute(e.clientY - rect.top);
    return clamp(
      snapTo(pointerMin - info.grabOffsetMin),
      0,
      DAY_MINUTES - info.duration,
    );
  };

  const handleColumnDragOver = (e, dayIdx) => {
    if (!dragInfoRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const start = pointerStart(e, dayIdx);
    if (start == null) return;
    const duration = dragInfoRef.current.duration;
    setDragPreview((prev) =>
      prev && prev.day === dayIdx && prev.start === start
        ? prev
        : { day: dayIdx, start, duration },
    );
    if (dragOverStrip != null) setDragOverStrip(null);
  };

  // Place a dragged task at `startMinute` on `toDay` (null = unscheduled).
  const commitDrop = (info, toDay, startMinute) => {
    const { task, fromDay } = info;
    const projectId = getTaskProjectId?.(task) ?? null;
    if (task._virtual) {
      if (task._dated || startMinute == null) return;
      // Materialise the auto-scheduled routine task at this time.
      onAddTask?.(toDay, {
        routineTaskId: routineIdOf(task),
        projectId,
        taskName: task.taskName,
        estimatedTime: task.estimatedTime || 0,
        startMinute,
        durationMinutes: info.duration,
      });
      return;
    }
    if (toDay === fromDay) {
      if ((task.startMinute ?? null) === startMinute) return;
      onUpdateTask?.(fromDay, task._id, { startMinute });
      return;
    }
    onMoveTask?.({
      taskId: String(task._id),
      fromDayOfWeek: fromDay,
      toDayOfWeek: toDay,
      toProjectId: projectId,
      startMinute,
    });
  };

  const handleColumnDrop = (e, dayIdx) => {
    const info = dragInfoRef.current;
    if (!info) return;
    e.preventDefault();
    const start = pointerStart(e, dayIdx);
    clearDrag();
    if (start == null) return;
    commitDrop(info, dayIdx, start);
  };

  const handleStripDragOver = (e, dayIdx) => {
    const info = dragInfoRef.current;
    if (!info || info.task._virtual) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStrip !== dayIdx) setDragOverStrip(dayIdx);
    if (dragPreview) setDragPreview(null);
  };

  const handleStripDrop = (e, dayIdx) => {
    const info = dragInfoRef.current;
    if (!info) return;
    e.preventDefault();
    clearDrag();
    if (info.task._virtual) return;
    commitDrop(info, dayIdx, null);
  };

  /* ── Click-and-drag range selection ──────────────────── */

  const endSelectionListeners = useRef(null);

  const handleColumnMouseDown = (e, dayIdx) => {
    if (e.button !== 0) return;
    if (e.target.closest("[data-block]")) return;
    const col = colRefs.current[dayIdx];
    if (!col) return;
    e.preventDefault();
    const rect = col.getBoundingClientRect();
    // +1 minute guards against sub-pixel rounding right on an hour line.
    const anchor = clamp(
      floorTo(yToMinute(e.clientY - rect.top) + 1),
      0,
      DAY_MINUTES - SNAP,
    );
    selRef.current = { day: dayIdx, anchor, moved: false };
    setSelection({ day: dayIdx, start: anchor, end: anchor + SNAP, done: false });

    const applyMove = (clientY) => {
      const s = selRef.current;
      if (!s) return;
      const r = colRefs.current[s.day]?.getBoundingClientRect();
      if (!r) return;
      const m = clamp(snapTo(yToMinute(clientY - r.top)), 0, DAY_MINUTES);
      if (m !== s.anchor) s.moved = true;
      let start = Math.min(s.anchor, m);
      let end = Math.max(s.anchor, m);
      if (end - start < SNAP) end = start + SNAP;
      setSelection({ day: s.day, start, end, done: false });
    };
    const onMove = (ev) => {
      applyMove(ev.clientY);
      edgeScrollRef.current?.update(ev.clientY, applyMove);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      edgeScrollRef.current?.stop();
      endSelectionListeners.current = null;
      const s = selRef.current;
      selRef.current = null;
      if (!s) return;
      setSelection((cur) => {
        if (!cur) return cur;
        let { start, end } = cur;
        if (!s.moved) {
          start = s.anchor;
          end = Math.min(DAY_MINUTES, start + CLICK_BLOCK);
        }
        return { day: s.day, start, end, done: true };
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    endSelectionListeners.current = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  };

  useEffect(() => () => endSelectionListeners.current?.(), []);

  /* ── Resize from the bottom edge ─────────────────────── */

  const handleResizeStart = (e, task, dayIdx, start) => {
    e.preventDefault();
    e.stopPropagation();
    const initial = taskDuration(task);
    resizeRef.current = {
      task,
      dayIdx,
      start,
      initial,
      y0: e.clientY,
      duration: initial,
    };
    setResizing({ taskId: task._id, duration: initial });
    // Pointer travel plus whatever the grid auto-scrolled underneath it.
    const scrollTop0 = scrollRef.current?.scrollTop ?? 0;
    const applyResize = (clientY) => {
      const r = resizeRef.current;
      if (!r) return;
      const scrolled = (scrollRef.current?.scrollTop ?? 0) - scrollTop0;
      const delta = yToMinute(clientY + scrolled - r.y0);
      const dur = clamp(
        snapTo(r.initial + delta),
        MIN_BLOCK,
        DAY_MINUTES - r.start,
      );
      r.duration = dur;
      setResizing((cur) =>
        cur && cur.duration === dur ? cur : { taskId: r.task._id, duration: dur },
      );
    };
    const onMove = (ev) => {
      applyResize(ev.clientY);
      edgeScrollRef.current?.update(ev.clientY, applyResize);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      edgeScrollRef.current?.stop();
      const r = resizeRef.current;
      resizeRef.current = null;
      setResizing(null);
      if (r && r.duration !== r.initial) {
        onUpdateTask?.(r.dayIdx, r.task._id, { durationMinutes: r.duration });
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /* ── Rendering helpers ───────────────────────────────── */

  const gridCols = {
    gridTemplateColumns: `${GUTTER_PX}px repeat(${visibleDays.length}, minmax(0, 1fr))`,
  };

  const toggleTask = (task, dayIdx, block) => {
    if (task._virtual) {
      if (task._dated) return;
      onAddTask?.(dayIdx, {
        routineTaskId: routineIdOf(task),
        projectId: getTaskProjectId?.(task) ?? null,
        taskName: task.taskName,
        estimatedTime: task.estimatedTime || 0,
        completed: true,
        ...(block ? { startMinute: block.start, durationMinutes: block.end - block.start } : {}),
      });
      return;
    }
    onToggleTask?.(dayIdx, task._id, !task.completed);
  };

  const renderEditControls = (task, dayIdx) => {
    if (task._virtual) return null;
    const key = `cal-edit-${dayIdx}-${task._id}`;
    return (
      <div className="relative shrink-0">
        <button
          ref={(el) => {
            editBtnRefs.current[key] = el;
          }}
          type="button"
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded text-fg-subtle hover:text-primary transition-all"
          onClick={(e) => {
            e.stopPropagation();
            setEditingKey((cur) => (cur === key ? null : key));
          }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Task options"
        >
          <IconDotsVertical className="w-3.5 h-3.5" />
        </button>
        {editingKey === key ? (
          <TaskEditPopover
            task={task}
            onSave={(updates) => onUpdateTask?.(dayIdx, task._id, updates)}
            onDelete={() => onDeleteTask?.(dayIdx, task._id)}
            onClose={() => setEditingKey(null)}
            anchorRef={{ current: editBtnRefs.current[key] }}
          />
        ) : null}
      </div>
    );
  };

  const blockTone = (task) =>
    task.completed
      ? "bg-success-soft border-success/40 text-fg-subtle"
      : task._virtual && !task._dated
        ? "bg-warning-soft border-warning/60 border-dashed text-fg-muted"
        : task._dated
          ? "bg-surface-2 border-edge-strong text-fg"
          : "bg-primary-soft border-primary/40 text-fg";

  const renderStripChip = (task, dayIdx) => {
    const colors = colorsFor(task);
    const draggable = canDrag(task);
    return (
      <div
        key={task._id}
        data-block
        draggable={draggable}
        onDragStart={(e) => handleDragStart(e, task, dayIdx, false)}
        onDragEnd={clearDrag}
        className={`group flex items-center gap-1 px-1.5 py-1 rounded-md border text-[11px] leading-tight ${blockTone(task)} ${
          draggable ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        title={task.notes || task.taskName}
      >
        {colors ? (
          <TaskColorLines
            manualColor={colors.manualColor}
            conditionalColor={colors.conditionalColor}
          />
        ) : null}
        <button
          type="button"
          className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
            task.completed
              ? "bg-success border-success text-white"
              : task._virtual && !task._dated
                ? "border-dashed border-warning/70 hover:border-success"
                : task._dated
                  ? "border-edge opacity-40 cursor-default"
                  : "border-edge hover:border-success"
          }`}
          onClick={() => toggleTask(task, dayIdx, null)}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          disabled={task._dated}
        >
          {task.completed ? <IconCheck className="w-2.5 h-2.5" /> : null}
        </button>
        <span
          className={`flex-1 min-w-0 truncate ${task.completed ? "line-through" : ""} ${
            task._virtual && !task._dated ? "italic" : ""
          }`}
        >
          {task.taskName}
        </span>
        {task.notes ? (
          <span className="shrink-0 text-warning" title={task.notes}>
            <IconNote className="w-3 h-3" />
          </span>
        ) : null}
        {task.estimatedTime ? (
          <span className="text-[10px] text-fg-subtle shrink-0">
            {task.estimatedTime}
          </span>
        ) : null}
        {renderEditControls(task, dayIdx)}
      </div>
    );
  };

  const renderBlock = ({ task, start, end, lane, lanes }, dayIdx) => {
    const colors = colorsFor(task);
    const draggable = canDrag(task);
    const top = minuteToY(start);
    const height = Math.max(minuteToY(end - start), 18);
    const showTime = height >= 34;
    const isResizing = resizing && String(resizing.taskId) === String(task._id);
    return (
      <div
        key={task._id}
        data-block
        draggable={draggable}
        onDragStart={(e) => handleDragStart(e, task, dayIdx, true)}
        onDragEnd={clearDrag}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          top,
          height,
          left: `calc(${(lane / lanes) * 100}% + 2px)`,
          width: `calc(${100 / lanes}% - 4px)`,
        }}
        className={`group absolute rounded-md border px-1.5 py-0.5 text-[11px] leading-tight overflow-hidden shadow-sm select-none ${blockTone(task)} ${
          draggable ? "cursor-grab active:cursor-grabbing" : ""
        } ${isResizing ? "ring-2 ring-focus/40" : ""}`}
        title={`${task.taskName} · ${minutesToTime(start)} – ${minutesToTime(end)}${
          task.notes ? `\n${task.notes}` : ""
        }`}
      >
        <div className="flex items-start gap-1 h-full">
          {colors ? (
            <TaskColorLines
              manualColor={colors.manualColor}
              conditionalColor={colors.conditionalColor}
            />
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                  task.completed
                    ? "bg-success border-success text-white"
                    : "border-edge hover:border-success"
                }`}
                onClick={() => toggleTask(task, dayIdx, { start, end })}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
              >
                {task.completed ? <IconCheck className="w-2.5 h-2.5" /> : null}
              </button>
              <span
                className={`flex-1 min-w-0 truncate font-medium ${
                  task.completed ? "line-through" : ""
                }`}
              >
                {task.taskName}
              </span>
              {task.notes ? (
                <span className="shrink-0 text-warning" title={task.notes}>
                  <IconNote className="w-3 h-3" />
                </span>
              ) : null}
              {renderEditControls(task, dayIdx)}
            </div>
            {showTime ? (
              <div className="text-[10px] text-fg-subtle mt-0.5">
                {minutesToTime(start)} – {minutesToTime(end)}
              </div>
            ) : null}
          </div>
        </div>
        {!task.completed && !task._virtual ? (
          <div
            className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize"
            draggable={false}
            onMouseDown={(e) => handleResizeStart(e, task, dayIdx, start)}
            onDragStart={(e) => e.preventDefault()}
            aria-hidden="true"
          />
        ) : null}
      </div>
    );
  };

  const selectionDurationLabel = selection
    ? `${minutesToTime(selection.start)} – ${minutesToTime(selection.end)}`
    : "";

  return (
    <div className="bg-surface border border-edge rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[360px]">
      <div
        ref={scrollRef}
        className="relative flex-1 min-h-0 overflow-auto select-none"
        // Dragging a block near the top or bottom edge scrolls the grid.
        onDragOver={(e) => {
          if (dragInfoRef.current) edgeScrollRef.current?.update(e.clientY);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) edgeScrollRef.current?.stop();
        }}
        onDrop={() => edgeScrollRef.current?.stop()}
      >
        <div className={compact ? "" : "min-w-[760px]"}>
          {/* Sticky header + unscheduled strip */}
          <div className="sticky top-0 z-20 bg-surface border-b border-edge">
            <div className="grid" style={gridCols}>
              <div className="px-2 py-2 text-[10px] uppercase tracking-wide text-fg-subtle flex items-end">
                {weekPlan?.weekStart ? "" : null}
              </div>
              {visibleDays.map((i) => {
                const name = dayNames[i];
                const isToday = i === todayDow;
                return (
                  <div
                    key={name}
                    className="px-2 py-2 text-center border-l border-edge"
                  >
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        isToday ? "text-primary" : "text-fg-subtle"
                      }`}
                    >
                      {name}
                    </div>
                    <div
                      className={`inline-flex items-center justify-center mt-0.5 px-2 py-0.5 rounded-full text-sm font-bold ${
                        isToday ? "bg-primary text-primary-fg" : "text-fg"
                      }`}
                    >
                      {dayDates[i] || ""}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Unscheduled strip */}
            <div className="grid border-t border-edge" style={gridCols}>
              <div className="px-2 py-1.5 text-[10px] leading-tight text-fg-subtle flex items-center">
                No time yet
              </div>
              {visibleDays.map((dayIdx) => {
                const chips = stripByDay[dayIdx] || [];
                const isOver = dragOverStrip === dayIdx;
                const addKey = `strip-add-${dayIdx}`;
                return (
                  <div
                    key={dayIdx}
                    data-strip-day={dayIdx}
                    className={`min-h-[40px] px-1 py-1 border-l border-edge space-y-1 transition-colors ${
                      isOver ? "bg-primary-soft" : ""
                    }`}
                    onDragOver={(e) => handleStripDragOver(e, dayIdx)}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget))
                        setDragOverStrip((cur) => (cur === dayIdx ? null : cur));
                    }}
                    onDrop={(e) => handleStripDrop(e, dayIdx)}
                  >
                    {chips.map((task) => renderStripChip(task, dayIdx))}
                    <div className="relative">
                      <button
                        ref={(el) => {
                          addBtnRefs.current[addKey] = el;
                        }}
                        type="button"
                        className="w-full flex items-center justify-center gap-1 py-0.5 rounded-md text-[10px] text-fg-subtle hover:text-primary hover:bg-primary-soft transition-colors"
                        onClick={() =>
                          setAddingStripDay((cur) => (cur === dayIdx ? null : dayIdx))
                        }
                        aria-label="Add task without a time"
                        title="Add task without a time"
                      >
                        <IconPlus className="w-3 h-3" />
                      </button>
                      {addingStripDay === dayIdx ? (
                        <AddTaskPopover
                          routineTasks={routineTasks}
                          todoTasks={todoTasks}
                          projectNameMap={projectNameMap}
                          projectColorMap={projectColorMap}
                          projectId={null}
                          onAdd={(data) => onAddTask?.(dayIdx, data)}
                          onClose={() => setAddingStripDay(null)}
                          anchorRef={{ current: addBtnRefs.current[addKey] }}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hour grid */}
          <div className="grid" style={gridCols}>
            {/* Gutter */}
            <div className="relative" style={{ height: minuteToY(DAY_MINUTES) }}>
              {Array.from({ length: 24 }, (_, h) =>
                h === 0 ? null : (
                  <div
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[10px] text-fg-subtle tabular-nums"
                    style={{ top: minuteToY(h * 60) }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ),
              )}
            </div>

            {visibleDays.map((dayIdx) => {
              const blocks = timedByDay[dayIdx] || [];
              const isToday = dayIdx === todayDow;
              const preview =
                dragPreview && dragPreview.day === dayIdx ? dragPreview : null;
              const sel = selection && selection.day === dayIdx ? selection : null;
              return (
                <div
                  key={dayIdx}
                  data-day={dayIdx}
                  ref={(el) => {
                    colRefs.current[dayIdx] = el;
                  }}
                  className={`relative border-l border-edge ${
                    isToday ? "bg-primary-soft/25" : ""
                  }`}
                  style={{
                    height: minuteToY(DAY_MINUTES),
                    backgroundImage: `repeating-linear-gradient(to bottom, color-mix(in oklab, var(--border) 70%, transparent) 0 1px, transparent 1px ${HOUR_PX}px)`,
                  }}
                  onMouseDown={(e) => handleColumnMouseDown(e, dayIdx)}
                  onDragOver={(e) => handleColumnDragOver(e, dayIdx)}
                  onDrop={(e) => handleColumnDrop(e, dayIdx)}
                >
                  {blocks.map((b) => renderBlock(b, dayIdx))}

                  {preview ? (
                    <div
                      className="absolute left-0.5 right-0.5 rounded-md border-2 border-dashed border-primary/60 bg-primary/10 pointer-events-none"
                      style={{
                        top: minuteToY(preview.start),
                        height: Math.max(minuteToY(preview.duration), 18),
                      }}
                    >
                      <div className="px-1.5 py-0.5 text-[10px] text-primary">
                        {minutesToTime(preview.start)} –{" "}
                        {minutesToTime(preview.start + preview.duration)}
                      </div>
                    </div>
                  ) : null}

                  {sel ? (
                    <div
                      ref={selectionAnchorRef}
                      className="absolute left-0.5 right-0.5 rounded-md border-2 border-primary bg-primary/15 pointer-events-none z-10"
                      style={{
                        top: minuteToY(sel.start),
                        height: Math.max(minuteToY(sel.end - sel.start), 18),
                      }}
                    >
                      <div className="px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {selectionDurationLabel}
                      </div>
                    </div>
                  ) : null}

                  {isToday ? (
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-accent pointer-events-none z-10"
                      style={{ top: minuteToY(nowMinute) }}
                    >
                      <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-accent" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Popover for a finished range selection */}
      {selection?.done ? (
        <AddTaskPopover
          routineTasks={routineTasks}
          todoTasks={todoTasks}
          projectNameMap={projectNameMap}
          projectColorMap={projectColorMap}
          projectId={null}
          onAdd={(data) =>
            onAddTask?.(selection.day, {
              ...data,
              startMinute: selection.start,
              durationMinutes: selection.end - selection.start,
            })
          }
          onClose={() => setSelection(null)}
          anchorRef={selectionAnchorRef}
        />
      ) : null}
    </div>
  );
}
