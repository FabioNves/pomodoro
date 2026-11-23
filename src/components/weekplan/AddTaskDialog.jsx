"use client";

// What opens when a task is added to the calendar (a time range, or the "+"
// of a day's "no time yet" strip) and to the planner's week grid: a
// centred window with the projects down the side (along the top on a phone)
// and Cycles / Tasks / New tabs. A cycle says how often it runs
// (describeRoutineSchedule), a new task can take a length preset.
//
// `onAdd` gets the payloads the calendar always took: a cycle
// { routineTaskId, projectId, taskName, estimatedTime }, a todo or a new
// task { taskName, estimatedTime, projectId }.

import React, { useMemo, useState } from "react";
import { MicroLabel } from "@/components/timer/TimerPopover";
import ModalShell from "@/components/planner/ModalShell";
import { formatMinutes } from "./WeekPlanShared";
import { describeRoutineSchedule } from "@/lib/routineSchedule";

/* ── data ──────────────────────────────────────────────── */

const pidOf = (v) => (v == null ? null : typeof v === "object" ? String(v._id || v) : String(v));
const LENGTHS = [15, 25, 30, 45, 60, 90];

/** Cycles, todos and projects in one shape the dialog reads. */
function useAddTaskData({ routineTasks = [], todoTasks = [], projectNameMap = {}, projectColorMap = {}, projectId }) {
  return useMemo(() => {
    const cycles = routineTasks.map((rt) => ({
      kind: "cycle",
      id: String(rt._id),
      title: rt.title || "",
      projectId: pidOf(rt.project) || projectId || null,
      minutes: rt.estimatedTime || 0,
      color: rt.color || null,
      schedule: describeRoutineSchedule(rt),
      source: rt,
    }));
    const todos = todoTasks.map((t) => ({
      kind: "todo",
      id: String(t._id),
      title: t.title || "",
      projectId: pidOf(t.project) || projectId || null,
      minutes: 0,
      source: t,
    }));
    const ids = new Set([...Object.keys(projectNameMap), ...cycles.map((c) => c.projectId), ...todos.map((t) => t.projectId)].filter(Boolean));
    const projects = [...ids]
      .map((id) => ({
        id,
        name: projectNameMap[id] || "Project",
        colorClass: projectColorMap[id] || "bg-edge-strong",
        cycles: cycles.filter((c) => c.projectId === id).length,
        todos: todos.filter((t) => t.projectId === id).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const hasLoose = cycles.some((c) => !c.projectId) || todos.some((t) => !t.projectId);
    return { cycles, todos, projects, hasLoose };
  }, [routineTasks, todoTasks, projectNameMap, projectColorMap, projectId]);
}

/** The payload `onAdd` expects for a picked item. */
function payloadFor(item) {
  if (item.kind === "cycle") {
    return { routineTaskId: item.source._id, projectId: item.projectId, taskName: item.title, estimatedTime: item.minutes };
  }
  return { taskName: item.title, estimatedTime: 0, projectId: item.projectId };
}

/* ── shared bits ───────────────────────────────────────── */

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 text-fg-subtle shrink-0" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
const IconCycle = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M21 12a9 9 0 01-15.5 6.2M3 12a9 9 0 0115.5-6.2" />
    <path d="M18 2v4h-4M6 22v-4h4" />
  </svg>
);
const IconTodo = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const IconPlus = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <rect x="4" y="9.25" width="12" height="1.5" rx=".75" />
    <rect x="9.25" y="4" width="1.5" height="12" rx=".75" />
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

/** One pickable cycle or task. */
function ItemRow({ item, projectLabel, projectClass, onPick, active = false }) {
  const isCycle = item.kind === "cycle";
  return (
    <button
      type="button"
      onClick={onPick}
      title={item.title}
      className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
        active ? "bg-surface-hover text-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
      }`}
    >
      <span
        className={`grid place-items-center w-6 h-6 rounded-md shrink-0 ${isCycle ? "bg-success-soft text-success" : "bg-accent-soft text-accent"}`}
        style={isCycle && item.color ? { color: item.color } : undefined}
        aria-hidden="true"
      >
        {isCycle ? <IconCycle /> : <IconTodo />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-fg truncate">{item.title}</span>
        {projectLabel || isCycle ? (
          <span className="flex items-center gap-1.5 text-[11px] text-fg-subtle min-w-0">
            {projectLabel ? (
              <>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${projectClass || "bg-edge-strong"}`} aria-hidden="true" />
                <span className="truncate shrink-0 max-w-[45%]">{projectLabel}</span>
              </>
            ) : null}
            {isCycle ? (
              <>
                {projectLabel ? <span aria-hidden="true">·</span> : null}
                <span className={`truncate ${item.schedule ? "text-success/90" : ""}`} title={item.schedule || "No schedule set"}>
                  {item.schedule || "No schedule set"}
                </span>
              </>
            ) : null}
          </span>
        ) : null}
      </span>
      {item.minutes ? <span className="text-[11px] text-fg-subtle tabular-nums shrink-0">{formatMinutes(item.minutes)}</span> : null}
      <span className="opacity-0 group-hover:opacity-100 text-primary shrink-0 transition-opacity" aria-hidden="true">
        <IconPlus />
      </span>
    </button>
  );
}

/* ── the dialog ────────────────────────────────────────── */

function AddTaskDialog({ data, when, timed, onAdd, onClose, startProject }) {
  const [project, setProject] = useState(startProject || "all");
  const [tab, setTab] = useState("cycles"); // cycles | todos | new
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(0);

  const q = query.trim().toLowerCase();
  const inProject = (it) => project === "all" || (project === "none" ? !it.projectId : it.projectId === project);
  const cycles = data.cycles.filter(inProject);
  const todos = data.todos.filter(inProject);
  const shown = (tab === "cycles" ? cycles : todos).filter((it) => !q || it.title.toLowerCase().includes(q));
  const nameOf = (id) => data.projects.find((p) => p.id === id);
  const realProject = project !== "all" && project !== "none" ? project : null;

  const pick = (item) => {
    onAdd(payloadFor(item));
    onClose();
  };
  const addNew = () => {
    if (!name.trim()) return;
    onAdd({ taskName: name.trim(), estimatedTime: minutes || 0, projectId: realProject });
    onClose();
  };

  const side = (id, label, colorClass, count) => {
    const on = project === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setProject(id)}
        className={`shrink-0 sm:w-full flex items-center gap-2 h-8 sm:h-9 px-2.5 rounded-lg text-left text-sm transition-colors ${
          on ? "bg-primary-soft text-fg font-semibold" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
        }`}
      >
        {colorClass ? <span className={`w-2 h-2 rounded-full shrink-0 ${colorClass}`} aria-hidden="true" /> : null}
        <span className="flex-1 min-w-0 truncate">{label}</span>
        <span className="hidden sm:inline text-[11px] tabular-nums text-fg-subtle">{count}</span>
      </button>
    );
  };
  const tabBtn = (id, label, Icon, count) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-semibold transition-colors ${
        tab === id ? "bg-surface text-fg shadow-sm" : "text-fg-subtle hover:text-fg"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {count != null ? <span className="tabular-nums text-fg-subtle font-medium">{count}</span> : null}
    </button>
  );

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Add a task"
      subtitle={when || undefined}
      size="lg"
    >
      <div className="flex flex-col sm:flex-row sm:h-[26rem]">
        {/* projects */}
        <nav aria-label="Projects" className="sm:w-48 shrink-0 border-b sm:border-b-0 sm:border-r border-edge p-2 sm:p-3 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto [scrollbar-width:none]">
          <MicroLabel className="hidden sm:block px-2.5 pb-1">Project</MicroLabel>
          {side("all", "All projects", null, data.cycles.length + data.todos.length)}
          {data.projects.map((p) => side(p.id, p.name, p.colorClass, p.cycles + p.todos))}
          {data.hasLoose ? side("none", "No project", "bg-edge-strong", data.cycles.filter((c) => !c.projectId).length + data.todos.filter((t) => !t.projectId).length) : null}
        </nav>

        {/* what to add */}
        <div className="flex-1 min-w-0 flex flex-col p-3 gap-3 min-h-[20rem]">
          <div role="tablist" className="flex gap-1 rounded-lg bg-surface-2 p-1">
            {tabBtn("cycles", "Cycles", IconCycle, cycles.length)}
            {tabBtn("todos", "Tasks", IconTodo, todos.length)}
            {tabBtn("new", "New", IconPlus, null)}
          </div>

          {tab === "new" ? (
            <div className="space-y-4">
              <label className="block">
                <MicroLabel className="mb-1.5">Name</MicroLabel>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addNew();
                  }}
                  placeholder="What will you do?"
                  className="w-full h-10 px-3 rounded-lg border border-edge bg-surface-2/60 text-sm text-fg outline-none focus:border-focus placeholder:text-fg-subtle"
                />
              </label>
              <div>
                <MicroLabel className="mb-1.5">Project</MicroLabel>
                <p className="flex items-center gap-2 text-sm text-fg">
                  <span className={`w-2 h-2 rounded-full ${realProject ? nameOf(realProject)?.colorClass : "bg-edge-strong"}`} aria-hidden="true" />
                  {realProject ? nameOf(realProject)?.name : "No project"}
                  <span className="text-xs text-fg-subtle sm:hidden">· pick one above</span>
                  <span className="text-xs text-fg-subtle hidden sm:inline">· pick one on the left</span>
                </p>
              </div>
              {timed ? null : <div>
                <MicroLabel className="mb-1.5 flex items-center gap-1.5"><IconClock /> Estimate</MicroLabel>
                <div className="flex flex-wrap gap-1.5">
                  {[0, ...LENGTHS].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMinutes(m)}
                      className={`h-8 px-3 rounded-lg border text-xs font-semibold tabular-nums transition-colors ${
                        minutes === m ? "border-primary bg-primary-soft text-fg" : "border-edge text-fg-muted hover:text-fg hover:bg-surface-hover"
                      }`}
                    >
                      {m ? formatMinutes(m) : "None"}
                    </button>
                  ))}
                </div>
              </div>}
              <button
                type="button"
                onClick={addNew}
                disabled={!name.trim()}
                className="w-full h-10 rounded-full bg-primary hover:bg-primary-hover text-primary-fg text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                Add task
              </button>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 h-9 px-2.5 rounded-lg border border-edge bg-surface-2/60 focus-within:border-focus">
                <IconSearch />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tab === "cycles" ? "Find a cycle" : "Find a task"}
                  className="flex-1 min-w-0 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
                  aria-label={tab === "cycles" ? "Find a cycle" : "Find a task"}
                />
              </label>
              <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 [scrollbar-width:thin]">
                {shown.length ? (
                  shown.map((it) => {
                    const p = nameOf(it.projectId);
                    return (
                      <ItemRow
                        key={`${it.kind}-${it.id}`}
                        item={it}
                        projectLabel={project === "all" ? p?.name || "No project" : null}
                        projectClass={p?.colorClass}
                        onPick={() => pick(it)}
                      />
                    );
                  })
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-xs text-fg-subtle">{q ? "Nothing matches." : tab === "cycles" ? "No cycles here." : "No open tasks here."}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setName(query.trim());
                        setTab("new");
                      }}
                      className="mt-2 text-xs font-semibold text-primary hover:underline"
                    >
                      Add {q ? `“${query.trim()}”` : "a new task"} instead
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/* ── the one the calendar opens ────────────────────────── */

/**
 * `when` is an optional line saying where the task goes ("Mon 23/11 ·
 * 09:00–10:00"); `timed` says a time range was picked, so a new task needs
 * no estimate. `anchorRef` is accepted for the callers that still pass it.
 */
export default function AddTaskPopover({ routineTasks, todoTasks, projectNameMap, projectColorMap, projectId = null, onAdd, onClose, anchorRef, when = "", timed = false }) {
  const data = useAddTaskData({ routineTasks, todoTasks, projectNameMap, projectColorMap, projectId });
  return <AddTaskDialog data={data} when={when} timed={timed} onAdd={onAdd} onClose={onClose} startProject={projectId ? String(projectId) : null} />;
}
