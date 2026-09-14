"use client";

// Timeline view: one row per project on a shared time axis. The project bar
// spans its start/end dates (or, when the project has none, the dated
// milestones and tasks it contains). Each milestone with dates, or with
// dated tasks, gets its own lane under the project bar; dated tasks show as
// small marks. Projects with nothing dated are listed underneath.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getProjectColorMeta } from "@/lib/projectColors";
import {
  compareMilestones,
  formatDateRange,
  formatShortDate,
  idOf,
  milestoneProgress,
  spanOf,
} from "@/lib/milestones";

const DAY = 86400000;
const ZOOMS = [
  { key: "weeks", label: "Weeks", dayWidth: 22 },
  { key: "months", label: "Months", dayWidth: 7 },
];
const LABEL_WIDTH = 224;
const LABEL_WIDTH_NARROW = 140;
const HEADER_HEIGHT = 44;
const PROJECT_LANE = 44;
const LANE = 30;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const diffDays = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
function startOfWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
  return x;
}
function unionSpan(spans) {
  let start = null;
  let end = null;
  for (const s of spans) {
    if (!s) continue;
    if (!start || s.start < start) start = s.start;
    if (!end || s.end > end) end = s.end;
  }
  return start ? { start, end } : null;
}

/** One row per project: its span, milestone lanes and loose dated tasks. */
function buildRows(projects, milestones, tasks) {
  const msByProject = new Map();
  for (const m of milestones) {
    const pid = idOf(m.project);
    const list = msByProject.get(pid) || [];
    list.push(m);
    msByProject.set(pid, list);
  }
  const tasksByProject = new Map();
  for (const t of tasks) {
    const pid = idOf(t.project);
    const list = tasksByProject.get(pid) || [];
    list.push(t);
    tasksByProject.set(pid, list);
  }

  return projects.map((p) => {
    const pid = String(p._id);
    const ms = [...(msByProject.get(pid) || [])].sort(compareMilestones);
    const all = tasksByProject.get(pid) || [];
    const datedTasks = all
      .map((t) => ({ task: t, span: spanOf(t) }))
      .filter((x) => x.span);
    const lanes = ms
      .map((m) => ({
        milestone: m,
        span: spanOf(m),
        progress: milestoneProgress(m, all),
        tasks: datedTasks.filter((x) => idOf(x.task.milestone) === String(m._id)),
      }))
      .filter((l) => l.span || l.tasks.length);
    const laneIds = new Set(lanes.map((l) => String(l.milestone._id)));
    const looseTasks = datedTasks.filter(
      (x) => !laneIds.has(idOf(x.task.milestone) || ""),
    );
    const own = spanOf(p);
    const derived = unionSpan([
      ...lanes.map((l) => l.span),
      ...datedTasks.map((x) => x.span),
    ]);
    return {
      project: p,
      span: own || derived,
      derived: !own && Boolean(derived),
      lanes,
      looseTasks,
      undatedMilestones: ms.length - lanes.filter((l) => l.span).length,
    };
  });
}

export default function TimelineView({
  projects = [],
  milestones = [],
  tasks = [],
  onOpenProject,
  onOpenMilestone,
  onManageProject,
}) {
  const [zoomKey, setZoomKey] = useState("weeks");
  const zoom = ZOOMS.find((z) => z.key === zoomKey) || ZOOMS[0];
  const dayWidth = zoom.dayWidth;
  const scrollRef = useRef(null);
  const hasProjects = projects.length > 0;
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const labelWidth = narrow ? LABEL_WIDTH_NARROW : LABEL_WIDTH;

  const rows = useMemo(() => buildRows(projects, milestones, tasks), [projects, milestones, tasks]);
  const scheduled = rows.filter((r) => r.span);
  const unscheduled = rows.filter((r) => !r.span);

  const range = useMemo(() => {
    const today = startOfDay(new Date());
    const union = unionSpan(
      scheduled.flatMap((r) => [
        r.span,
        ...r.lanes.map((l) => l.span),
        ...r.lanes.flatMap((l) => l.tasks.map((t) => t.span)),
        ...r.looseTasks.map((t) => t.span),
      ]),
    );
    let start = union ? union.start : addDays(today, -14);
    let end = union ? union.end : addDays(today, 42);
    if (today < start) start = today;
    if (today > end) end = today;
    start = startOfWeek(addDays(start, -7));
    end = addDays(end, 14);
    if (diffDays(start, end) < 56) end = addDays(start, 56);
    return { start, end, days: diffDays(start, end) + 1, today };
  }, [scheduled]);

  const x = useCallback(
    (date) => diffDays(range.start, date) * dayWidth,
    [range.start, dayWidth],
  );
  const width = range.days * dayWidth;
  const barStyle = (span) => ({
    left: x(span.start),
    width: Math.max(dayWidth, (diffDays(span.start, span.end) + 1) * dayWidth),
  });

  const { months, weeks } = useMemo(() => {
    const monthList = [];
    let m = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    while (m <= range.end) {
      const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      const left = Math.max(0, x(m));
      const right = Math.min(width, x(next));
      monthList.push({
        key: `${m.getFullYear()}-${m.getMonth()}`,
        left,
        width: right - left,
        label: m.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      });
      m = next;
    }
    const weekList = [];
    for (let d = startOfWeek(range.start); d <= range.end; d = addDays(d, 7)) {
      weekList.push({ key: d.getTime(), left: x(d), date: d });
    }
    return { months: monthList, weeks: weekList };
  }, [range, width, x]);

  const scrollToToday = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const visible = Math.max(0, el.clientWidth - labelWidth);
    el.scrollLeft = Math.max(0, x(range.today) - visible / 3);
  }, [x, range.today, labelWidth]);

  useEffect(() => {
    if (hasProjects) scrollToToday();
  }, [hasProjects, scrollToToday]);

  if (!hasProjects) {
    return <div className="p-6 text-sm text-fg-muted">Create a project to see it on the timeline.</div>;
  }

  const todayLeft = x(range.today);

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2 md:pr-8">
        <div
          className="inline-flex gap-0.5 p-0.5 rounded-lg bg-surface border border-edge"
          role="group"
          aria-label="Timeline zoom"
        >
          {ZOOMS.map((z) => (
            <button
              key={z.key}
              type="button"
              onClick={() => setZoomKey(z.key)}
              aria-pressed={zoomKey === z.key}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                zoomKey === z.key ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-hover"
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={scrollToToday}
          className="px-2.5 py-1 rounded-md border border-edge bg-surface text-xs font-medium text-fg-muted hover:bg-surface-hover"
        >
          Today
        </button>
        <span className="text-[11px] text-fg-subtle ml-auto">
          Project bar, one lane per milestone, small marks for dated tasks. Click a bar to open it.
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto border-t border-edge">
        <div style={{ width: labelWidth + width }} className="relative min-h-full">
          {/* Axis header */}
          <div className="sticky top-0 z-20 flex bg-surface border-b border-edge" style={{ height: HEADER_HEIGHT }}>
            <div
              className="sticky left-0 z-30 shrink-0 bg-surface border-r border-edge flex items-end px-3 pb-1 text-[11px] text-fg-subtle"
              style={{ width: labelWidth }}
            >
              {scheduled.length} project{scheduled.length === 1 ? "" : "s"} scheduled
            </div>
            <div className="relative shrink-0" style={{ width }}>
              {months.map((m) => (
                <div
                  key={m.key}
                  className="absolute top-0 h-[22px] border-l border-edge px-1.5 text-[11px] font-semibold text-fg-muted whitespace-nowrap overflow-hidden"
                  style={{ left: m.left, width: m.width }}
                >
                  {m.width > 60 ? m.label : ""}
                </div>
              ))}
              {weeks.map((w) => (
                <div
                  key={w.key}
                  className="absolute top-[22px] h-[22px] border-l border-edge/70 pl-1 text-[10px] text-fg-subtle whitespace-nowrap tabular-nums"
                  style={{ left: w.left }}
                >
                  {zoomKey === "weeks" ? formatShortDate(w.date) : w.date.getDate()}
                </div>
              ))}
              <div
                className="absolute top-0 bottom-0 w-px bg-danger"
                style={{ left: todayLeft }}
                aria-hidden="true"
              />
              <div
                className="absolute top-0 px-1 rounded-b bg-danger text-[10px] font-semibold text-white"
                style={{ left: todayLeft + 2 }}
              >
                Today
              </div>
            </div>
          </div>

          {/* Rows */}
          {scheduled.map((row) => {
            const p = row.project;
            const color = getProjectColorMeta(p.headerColor);
            const height = PROJECT_LANE + row.lanes.length * LANE;
            return (
              <div key={p._id} className="flex border-b border-edge">
                <div
                  className="sticky left-0 z-10 shrink-0 bg-surface border-r border-edge"
                  style={{ width: labelWidth }}
                >
                  <div className="px-3 flex flex-col justify-center" style={{ height: PROJECT_LANE }}>
                    <button
                      type="button"
                      className="flex items-center gap-2 min-w-0 text-left"
                      onClick={() => onOpenProject?.(p)}
                      title="Open project"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.swatchClass}`} />
                      <span className="text-sm font-semibold text-fg truncate">{p.name}</span>
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-fg-subtle hover:text-fg text-left truncate pl-[18px]"
                      onClick={() => onManageProject?.(p, "project")}
                      title="Change the project dates"
                    >
                      {formatDateRange(row.span.start, row.span.end)}
                      {row.derived ? " · from contents" : ""}
                      {row.undatedMilestones
                        ? ` · ${row.undatedMilestones} undated milestone${row.undatedMilestones === 1 ? "" : "s"}`
                        : ""}
                    </button>
                  </div>
                  {row.lanes.map((l) => (
                    <div
                      key={l.milestone._id}
                      className="flex items-center gap-1.5 pl-[30px] pr-2 text-xs text-fg-muted"
                      style={{ height: LANE }}
                    >
                      <span
                        className={`truncate ${
                          l.milestone.status === "completed" ? "line-through text-fg-subtle" : ""
                        }`}
                        title={l.milestone.name}
                      >
                        {l.milestone.name}
                      </span>
                      {l.tasks.length ? (
                        <span className="text-[10px] text-fg-subtle shrink-0">
                          {l.tasks.length} task{l.tasks.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="relative shrink-0" style={{ width, height }}>
                  {weeks.map((w) => (
                    <div
                      key={w.key}
                      className="absolute top-0 bottom-0 w-px bg-edge/50"
                      style={{ left: w.left }}
                      aria-hidden="true"
                    />
                  ))}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-danger/70"
                    style={{ left: todayLeft }}
                    aria-hidden="true"
                  />

                  {/* Project bar */}
                  <button
                    type="button"
                    className={`absolute rounded-md text-white text-[11px] font-medium px-2 truncate text-left ${
                      color.swatchClass
                    } ${row.derived ? "opacity-50" : ""} hover:brightness-110`}
                    style={{ ...barStyle(row.span), top: 10, height: 24 }}
                    onClick={() => onOpenProject?.(p)}
                    title={`${p.name}: ${formatDateRange(row.span.start, row.span.end)}${
                      row.derived ? " (from its milestones and tasks)" : ""
                    }`}
                  >
                    {barStyle(row.span).width > 110 ? p.name : ""}
                  </button>
                  {row.looseTasks.map((t) => (
                    <TaskMark
                      key={t.task._id}
                      item={t}
                      top={PROJECT_LANE - 8}
                      style={barStyle(t.span)}
                      color={color}
                    />
                  ))}

                  {/* Milestone lanes */}
                  {row.lanes.map((l, i) => {
                    const top = PROJECT_LANE + i * LANE;
                    const done = l.milestone.status === "completed";
                    return (
                      <React.Fragment key={l.milestone._id}>
                        {l.span ? (
                          <button
                            type="button"
                            className={`absolute rounded border overflow-hidden text-[11px] text-fg text-left ${
                              color.headerClass
                            } ${color.borderClass} ${done ? "opacity-60" : ""} hover:brightness-95`}
                            style={{ ...barStyle(l.span), top: top + 4, height: 18 }}
                            onClick={() => onOpenMilestone?.(p, l.milestone)}
                            title={`${l.milestone.name}: ${formatDateRange(l.span.start, l.span.end)} · ${
                              l.progress.percent
                            }%`}
                          >
                            <span
                              className={`absolute inset-y-0 left-0 ${color.swatchClass} opacity-40`}
                              style={{ width: `${l.progress.percent}%` }}
                              aria-hidden="true"
                            />
                            <span
                              className={`relative block px-1.5 leading-[18px] truncate ${
                                done ? "line-through" : ""
                              }`}
                            >
                              {barStyle(l.span).width > 70 ? l.milestone.name : ""}
                            </span>
                          </button>
                        ) : null}
                        {l.tasks.map((t) => (
                          <TaskMark
                            key={t.task._id}
                            item={t}
                            top={top + LANE - 8}
                            style={barStyle(t.span)}
                            color={color}
                          />
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!scheduled.length ? (
            <div className="sticky left-0 px-4 py-6 text-sm text-fg-muted" style={{ width: "100%" }}>
              Nothing has dates yet. Give a project, a milestone or a task a start or end date and it shows up here.
            </div>
          ) : null}
        </div>
      </div>

      {unscheduled.length ? (
        <div className="border-t border-edge px-4 py-2 md:pr-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          <span className="font-semibold text-fg-subtle uppercase tracking-wider text-[11px]">Not scheduled</span>
          {unscheduled.map((row) => {
            const color = getProjectColorMeta(row.project.headerColor);
            return (
              <button
                key={row.project._id}
                type="button"
                className="inline-flex items-center gap-1.5 hover:text-fg"
                onClick={() => onManageProject?.(row.project, "project")}
                title="Set the project dates"
              >
                <span className={`w-2 h-2 rounded-full ${color.swatchClass}`} />
                <span className="truncate max-w-[200px]">{row.project.name}</span>
                <span className="text-primary">Set dates</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** A dated task as a small mark on its lane. */
function TaskMark({ item, top, style, color }) {
  const { task, span } = item;
  return (
    <div
      className={`absolute h-1.5 rounded-full ${
        task.completed ? "bg-success" : `${color.swatchClass} opacity-70`
      }`}
      style={{ ...style, top, minWidth: 6 }}
      title={`${task.title}: ${formatDateRange(span.start, span.end)}${task.completed ? " · done" : ""}`}
    />
  );
}
