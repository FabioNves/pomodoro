"use client";

// "What are you working on?": the project and task the running session is
// saved against, as one control. The choice is not page state: it is the
// run's own context in TimerProvider, so the dashboard and the navbar timer
// always show the same thing and it survives navigation and reloads.
//
// The dashboard passes the lists it has already loaded; anywhere else (the
// navbar timer) the picker loads them itself the first time it opens.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TimerPopover, { MicroLabel } from "./TimerPopover";
import { useTimerControls, useTimerDisplay } from "./TimerProvider";
import { getProjectColorMeta } from "@/lib/projectColors";
import { idOf } from "@/lib/weekPlanView";
import { apiJson } from "@/utils/apiClient";

/* ── the choice ────────────────────────────────────────── */

export function useSessionChoice() {
  const { run } = useTimerDisplay();
  const { setSessionContext } = useTimerControls();
  const ctx = run?.context || {};
  const task = ctx.tasks?.[0]?.task || "";

  const choose = useCallback(
    ({ projectId = "", title = "", task: nextTask = "" }) => {
      setSessionContext({
        projectId,
        title,
        tasks: nextTask ? [{ task: nextTask, completed: false }] : [],
      });
      // The timer page reads the same key for its own project picker.
      try {
        localStorage.setItem("activeProject", JSON.stringify({ projectId, title }));
      } catch {}
    },
    [setSessionContext],
  );

  return { projectId: ctx.projectId || "", title: ctx.title || "", task, choose };
}

/* ── the lists, for screens that have not loaded them ──── */

function useSessionTargets(enabled, projectId) {
  const [projects, setProjects] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [routines, setRoutines] = useState({});

  useEffect(() => {
    if (!enabled || projects) return;
    let cancelled = false;
    Promise.all([apiJson("/api/projects").catch(() => []), apiJson("/api/tasks").catch(() => [])]).then(([p, t]) => {
      if (cancelled) return;
      setProjects(Array.isArray(p) ? p : []);
      setTasks(Array.isArray(t) ? t : []);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, projects]);

  useEffect(() => {
    if (!enabled || !projectId || routines[projectId]) return;
    let cancelled = false;
    apiJson(`/api/routine-tasks?projectId=${encodeURIComponent(projectId)}`)
      .catch(() => [])
      .then((list) => {
        if (!cancelled) setRoutines((r) => ({ ...r, [projectId]: Array.isArray(list) ? list : [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, routines]);

  const routineTasks = useMemo(() => Object.values(routines).flat(), [routines]);
  return { projects, tasks, routineTasks };
}

/* ── icons ─────────────────────────────────────────────── */

const Chevron = ({ open }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={`order-last w-3.5 h-3.5 shrink-0 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);
const IconTarget = ({ className = "w-3.5 h-3.5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 text-fg-subtle" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-accent shrink-0" aria-hidden="true">
    <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.09l6.79-6.8a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-fg-subtle shrink-0" aria-hidden="true">
    <rect x="4" y="9.25" width="12" height="1.5" rx=".75" />
    <rect x="9.25" y="4" width="1.5" height="12" rx=".75" />
  </svg>
);

/* ── the panel ─────────────────────────────────────────── */

function TaskRow({ label, hint, dot, color, selected, onPick }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors ${
        selected ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot || "bg-edge-strong"}`} style={color ? { backgroundColor: color } : undefined} aria-hidden="true" />
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {hint ? <span className="text-[11px] text-fg-subtle tabular-nums shrink-0">{hint}</span> : null}
      {selected ? <IconCheck /> : null}
    </button>
  );
}

function SessionPanel({ projects, tasks, routineTasks, loading, choice, onDone }) {
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const searchRef = useRef(null);
  // Focus the search with a mouse only: on a phone it would pop the keyboard
  // up over the list before anything is typed.
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) searchRef.current?.focus();
  }, []);
  const q = query.trim().toLowerCase();
  const { projectId, task, choose } = choice;
  const nameOf = (id) => projects.find((p) => String(p._id) === String(id))?.name || "";
  const swatch = (id) => {
    const p = projects.find((x) => String(x._id) === String(id));
    return p ? getProjectColorMeta(p.headerColor).swatchClass : "";
  };

  const pickProject = (id) => {
    // Tasks belong to a project, so changing it clears the task.
    choose({ projectId: id, title: id ? nameOf(id) : "", task: id === projectId ? task : "" });
  };
  const pickTask = (name, inProject = projectId) => {
    choose({ projectId: inProject || "", title: inProject ? nameOf(inProject) : "", task: name === task && inProject === projectId ? "" : name });
    onDone();
  };

  const openTasks = tasks.filter((t) => !t.completed);
  const projectChips = projects.filter((p) => !q || p.name.toLowerCase().includes(q));
  // Searching looks through every project; otherwise the chosen one's lists.
  const todo = q
    ? openTasks.filter((t) => t.title?.toLowerCase().includes(q))
    : projectId
      ? openTasks.filter((t) => String(idOf(t.project)) === String(projectId))
      : [];
  const cycles = q
    ? routineTasks.filter((r) => r.title?.toLowerCase().includes(q))
    : projectId
      ? routineTasks.filter((r) => String(idOf(r.project)) === String(projectId))
      : [];

  const addCustom = () => {
    const name = custom.trim() || query.trim();
    if (!name) return;
    choose({ projectId, title: projectId ? nameOf(projectId) : "", task: name });
    setCustom("");
    onDone();
  };

  const chip = (active) =>
    `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium transition-colors max-w-full ${
      active ? "border-primary bg-primary-soft text-fg" : "border-edge text-fg-muted hover:text-fg hover:border-edge-strong hover:bg-surface-hover"
    }`;

  return (
    <div className="w-[20rem] flex flex-col max-h-[min(70vh,30rem)]">
      <div className="p-3 pb-2 space-y-2.5 border-b border-edge">
        <div className="flex items-center justify-between">
          <MicroLabel>Working on</MicroLabel>
          {projectId || task ? (
            <button type="button" onClick={() => choose({})} className="text-[11px] text-fg-subtle hover:text-danger transition-colors">
              Clear
            </button>
          ) : null}
        </div>
        <label className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-edge bg-surface-2/60 focus-within:border-focus">
          <IconSearch />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q && !todo.length && !cycles.length) addCustom();
            }}
            placeholder="Find a project or task"
            className="flex-1 min-w-0 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
            aria-label="Find a project or task"
          />
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 [scrollbar-width:thin]">
        <div>
          <MicroLabel className="mb-1.5">Project</MicroLabel>
          {loading ? (
            <p className="text-xs text-fg-subtle">Loading…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {!q ? (
                <button type="button" className={chip(!projectId)} onClick={() => pickProject("")}>
                  None
                </button>
              ) : null}
              {projectChips.map((p) => (
                <button key={p._id} type="button" className={chip(String(p._id) === projectId)} onClick={() => pickProject(String(p._id))}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getProjectColorMeta(p.headerColor).swatchClass}`} aria-hidden="true" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
              {q && !projectChips.length ? <p className="text-xs text-fg-subtle">No project matches</p> : null}
            </div>
          )}
        </div>

        <div role="listbox" aria-label="Task">
          <MicroLabel className="mb-1">
            Task{!q && projectId ? <span className="normal-case tracking-normal font-normal"> · {nameOf(projectId)}</span> : null}
          </MicroLabel>
          {!q && !projectId ? (
            <p className="text-xs text-fg-subtle px-0.5 py-1">Pick a project to see its tasks, or type one below.</p>
          ) : null}
          {todo.length ? (
            <div className="space-y-0.5">
              {todo.map((t) => (
                <TaskRow
                  key={t._id}
                  label={t.title}
                  dot={q ? swatch(idOf(t.project)) : "bg-accent/70"}
                  hint={q ? nameOf(idOf(t.project)) : undefined}
                  selected={task === t.title && String(idOf(t.project)) === projectId}
                  onPick={() => pickTask(t.title, idOf(t.project) || "")}
                />
              ))}
            </div>
          ) : null}
          {cycles.length ? (
            <>
              <p className="mt-2 mb-0.5 px-0.5 text-[10px] uppercase tracking-[0.16em] text-fg-subtle/80">Cycles</p>
              <div className="space-y-0.5">
                {cycles.map((r) => (
                  <TaskRow
                    key={r._id}
                    label={r.title}
                    color={r.color || undefined}
                    dot="bg-success/70"
                    hint={r.estimatedTime ? `${r.estimatedTime} min` : undefined}
                    selected={task === r.title && String(idOf(r.project)) === projectId}
                    onPick={() => pickTask(r.title, idOf(r.project) || "")}
                  />
                ))}
              </div>
            </>
          ) : null}
          {(q || projectId) && !todo.length && !cycles.length && !loading ? (
            <p className="text-xs text-fg-subtle px-0.5 py-1">{q ? "No task matches." : "No open tasks in this project."}</p>
          ) : null}
        </div>
      </div>

      <div className="p-2 border-t border-edge">
        <label className="flex items-center gap-2 h-8 px-2.5 rounded-lg hover:bg-surface-hover focus-within:bg-surface-hover transition-colors">
          <IconPlus />
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCustom();
            }}
            placeholder={q && !todo.length && !cycles.length ? `Use “${query.trim()}”` : "Type a task and press Enter"}
            className="flex-1 min-w-0 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
            aria-label="Custom task"
          />
        </label>
      </div>
    </div>
  );
}

/* ── the trigger ───────────────────────────────────────── */

/**
 * A chip made to sit inside the timer's control bar: "● Project › Task".
 * It shrinks with the bar (the bar is a size container): on a narrow bar
 * the task is left out and the project name truncates. `grow` lets it take the
 * free width of the row. Pass `projects`, `tasks` and `routineTasks` when
 * the screen has them; otherwise it loads them.
 */
export default function SessionPicker({ projects: given, tasks: givenTasks, routineTasks: givenRoutines, align = "center", grow = false, className = "" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const choice = useSessionChoice();
  const selfLoad = !given;
  const loaded = useSessionTargets(selfLoad, choice.projectId);
  const projects = given || loaded.projects || [];
  const tasks = givenTasks || loaded.tasks;
  const routineTasks = givenRoutines || loaded.routineTasks;
  const loading = selfLoad && !loaded.projects;

  const project = projects.find((p) => String(p._id) === choice.projectId);
  const projectName = project?.name || choice.title;
  const swatch = project ? getProjectColorMeta(project.headerColor).swatchClass : "bg-primary";
  const empty = !projectName && !choice.task;
  const summary = empty ? "Nothing chosen" : [projectName, choice.task].filter(Boolean).join(", ");

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Working on: ${summary}. Change`}
        title={empty ? "What are you working on?" : summary}
        className={`min-w-0 inline-flex items-center gap-2 h-9 pl-2.5 @min-[24rem]:pl-3 pr-2 rounded-full text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 ${
          grow ? "flex-1" : "shrink"
        } ${open ? "bg-primary-soft/60" : "bg-surface/50 hover:bg-surface-hover"} ${className}`}
      >
        {empty ? (
          <>
            <IconTarget className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
            <span className="text-fg-muted truncate">Working on?</span>
          </>
        ) : (
          <>
            <span className={`w-2 h-2 rounded-full shrink-0 ${projectName ? swatch : "bg-edge-strong"}`} aria-hidden="true" />
            <span className="font-semibold text-fg truncate max-w-[10rem] min-w-[3.5rem]">{projectName || "No project"}</span>
            {choice.task ? (
              <>
                <span className="hidden @min-[28rem]:inline text-fg-subtle" aria-hidden="true">›</span>
                <span className="hidden @min-[28rem]:inline text-fg-muted truncate min-w-0 shrink-[6]">{choice.task}</span>
              </>
            ) : null}
          </>
        )}
        <Chevron open={open} />
        {grow ? <span className="flex-1" aria-hidden="true" /> : null}
      </button>
      <TimerPopover anchorRef={ref} open={open} onClose={() => setOpen(false)} align={align} label="What are you working on?">
        <SessionPanel projects={projects} tasks={tasks} routineTasks={routineTasks} loading={loading} choice={choice} onDone={() => setOpen(false)} />
      </TimerPopover>
    </>
  );
}
