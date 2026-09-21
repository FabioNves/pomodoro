"use client";

// The Tasks column of the planner's Calendar + Tasks split view: every
// pending task by project, to be dragged onto the calendar beside it (or
// sent to a day from its menu). A task placed on the calendar becomes a week
// task in the same project, exactly as the calendar's own "Todo" picker does;
// the task itself stays on the list until it is ticked off here.

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Dropdown from "@/components/ui/Dropdown";
import { PopoverMenu } from "@/components/notebook/notebookUi";
import { getProjectColorMeta } from "@/lib/projectColors";
import { PLANNER_DRAG_TYPE, endExternalDrag, startExternalDrag } from "@/lib/plannerDrag";
import { dayShortName, formatDayMonth, weekDates } from "@/utils/timeUtils";

const idOf = (v) => (v == null ? null : typeof v === "object" ? String(v._id || v) : String(v));

function IconGrip({ className = "w-3.5 h-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function IconCalendarPlus({ className = "w-3.5 h-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4M12 12v6M9 15h6" />
    </svg>
  );
}

function IconChevron({ open, className = "w-3.5 h-3.5" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`${className} shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

function TaskLine({ task, project, subtasks, dayItems, onToggle }) {
  const [leaving, setLeaving] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => {
        startExternalDrag({ taskName: task.title, projectId: idOf(task.project), duration: 60 });
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData(PLANNER_DRAG_TYPE, String(task._id));
        e.dataTransfer.setData("text/plain", task.title);
      }}
      onDragEnd={endExternalDrag}
      className={`group flex items-center gap-2 pl-1 pr-1.5 py-1.5 rounded-lg hover:bg-surface-hover cursor-grab active:cursor-grabbing transition-opacity ${
        leaving ? "opacity-40" : ""
      }`}
      title={`Drag onto the calendar to plan “${task.title}”`}
    >
      <span className="text-fg-subtle/60 group-hover:text-fg-subtle shrink-0" aria-hidden="true">
        <IconGrip />
      </span>
      <button
        type="button"
        onClick={() => {
          // Faded while the server answers; a ticked task then leaves the
          // list, and one whose request failed comes back.
          setLeaving(true);
          Promise.resolve(onToggle(task)).finally(() => setLeaving(false));
        }}
        className="w-4 h-4 rounded border border-edge hover:border-success shrink-0 transition-colors"
        aria-label={`Mark “${task.title}” complete`}
      />
      <span className="flex-1 min-w-0 text-sm text-fg truncate">{task.title}</span>
      {subtasks ? (
        <span className="text-[10px] tabular-nums text-fg-subtle shrink-0" title={`${subtasks} subtask${subtasks === 1 ? "" : "s"}`}>
          +{subtasks}
        </span>
      ) : null}
      <PopoverMenu
        label={`Put “${task.title}” on a day`}
        trigger={<IconCalendarPlus />}
        className="p-1 rounded-md text-fg-subtle hover:text-primary hover:bg-primary-soft opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 transition-opacity"
        items={dayItems(task, project)}
      />
    </div>
  );
}

/**
 * @param {object} props
 * @param {object[]} props.projects        planner projects, in their order
 * @param {object[]} props.tasks           planner tasks
 * @param {object|null} props.weekPlan     the week the calendar shows
 * @param {(project: object, title: string) => Promise<void>} props.onAddTask
 * @param {(task: object) => void} props.onToggleTask
 * @param {(dayIdx: number, data: object) => void} props.onAddToDay  adds a week task
 * @param {() => void} props.onClose
 */
export default function TasksPanel({ projects = [], tasks = [], weekPlan, onAddTask, onToggleTask, onAddToDay, onClose }) {
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [newTitle, setNewTitle] = useState("");
  const [newProject, setNewProject] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [showLater, setShowLater] = useState({});

  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        value: String(p._id),
        label: p.name,
        colorClass: getProjectColorMeta(p.headerColor).swatchClass,
      })),
    [projects],
  );

  // Pending top-level tasks by project, this week's first; subtasks are
  // counted on their parent rather than listed.
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const subtaskCount = new Map();
    for (const t of tasks) {
      if (t.parentTask && !t.completed) {
        const parent = idOf(t.parentTask);
        subtaskCount.set(parent, (subtaskCount.get(parent) || 0) + 1);
      }
    }
    return projects
      .filter((p) => projectFilter === "all" || String(p._id) === projectFilter)
      .map((p) => {
        const mine = tasks
          .filter((t) => idOf(t.project) === String(p._id) && !t.completed && !t.parentTask)
          .filter((t) => !needle || String(t.title || "").toLowerCase().includes(needle))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return {
          project: p,
          colorClass: getProjectColorMeta(p.headerColor).swatchClass,
          thisWeek: mine.filter((t) => !t.scheduledForLater),
          later: mine.filter((t) => t.scheduledForLater),
          subtaskCount,
        };
      })
      .filter((g) => g.thisWeek.length || g.later.length || (!needle && projectFilter !== "all"));
  }, [projects, tasks, query, projectFilter]);

  const pendingTotal = useMemo(() => tasks.filter((t) => !t.completed && !t.parentTask).length, [tasks]);

  const days = useMemo(() => (weekPlan?.weekStart ? weekDates(weekPlan.weekStart) : []), [weekPlan?.weekStart]);
  const dayItems = (task) =>
    days.map((date, i) => ({
      label: `${dayShortName(date)} ${formatDayMonth(date)}`,
      onClick: () => onAddToDay(i, { taskName: task.title, projectId: idOf(task.project), estimatedTime: 0 }),
    }));

  const addProjectId = newProject || (projectFilter !== "all" ? projectFilter : projects[0] ? String(projects[0]._id) : null);
  const [addError, setAddError] = useState("");
  const submitNew = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    const project = projects.find((p) => String(p._id) === addProjectId);
    if (!title || !project) return;
    setNewTitle("");
    setAddError("");
    const created = await onAddTask(project, title);
    if (!created) {
      // Put back what was typed rather than lose it.
      setNewTitle((current) => current || title);
      setAddError("The task could not be added. Try again.");
    }
  };

  return (
    <aside className="h-full flex flex-col min-h-0 bg-surface border border-edge rounded-2xl shadow-sm overflow-hidden" aria-label="Tasks">
      <header className="px-3 pt-3 pb-2.5 border-b border-edge space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-fg leading-tight">Tasks</h3>
            <p className="text-[11px] text-fg-subtle">
              {pendingTotal} pending · drag one onto a day
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors"
            aria-label="Hide the tasks column"
            title="Hide the tasks column"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative flex-1 min-w-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle pointer-events-none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
              className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-xs text-fg outline-none placeholder:text-fg-subtle focus:border-focus [&::-webkit-search-cancel-button]:appearance-none"
            />
          </label>
          <Dropdown
            value={projectFilter}
            onChange={setProjectFilter}
            options={[{ value: "all", label: "All projects" }, ...projectOptions]}
            compact
            align="end"
            menuLabel="Filter by project"
          />
        </div>
        {projects.length ? (
          <form onSubmit={submitNew} className="flex items-center gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a task…"
              aria-label="New task"
              maxLength={200}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-surface-2 border border-edge text-xs text-fg outline-none placeholder:text-fg-subtle focus:border-focus"
            />
            <Dropdown
              value={addProjectId}
              onChange={setNewProject}
              options={projectOptions}
              compact
              align="end"
              menuLabel="Project for the new task"
            />
          </form>
        ) : null}
        {addError ? (
          <p role="alert" className="text-[11px] text-danger">
            {addError}
          </p>
        ) : null}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 [scrollbar-width:thin]">
        {groups.length ? (
          groups.map((g) => {
            const key = String(g.project._id);
            const open = !collapsed[key];
            return (
              <section key={key}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                  className="w-full flex items-center gap-2 px-1.5 py-1 rounded-lg text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-subtle hover:text-fg-muted hover:bg-surface-hover transition-colors"
                >
                  <IconChevron open={open} />
                  <span className={`w-2 h-2 rounded-full shrink-0 ${g.colorClass}`} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate">{g.project.name}</span>
                  <span className="tabular-nums">{g.thisWeek.length + g.later.length}</span>
                </button>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      {g.thisWeek.map((t) => (
                        <TaskLine
                          key={t._id}
                          task={t}
                          project={g.project}
                          subtasks={g.subtaskCount.get(String(t._id)) || 0}
                          dayItems={dayItems}
                          onToggle={onToggleTask}
                        />
                      ))}
                      {!g.thisWeek.length && !g.later.length ? (
                        <p className="px-2 py-1.5 text-xs text-fg-subtle">Nothing pending here.</p>
                      ) : null}
                      {g.later.length ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowLater((s) => ({ ...s, [key]: !s[key] }))}
                            className="ml-6 mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] text-fg-subtle hover:text-fg-muted hover:bg-surface-hover"
                            aria-expanded={!!showLater[key]}
                          >
                            <IconChevron open={!!showLater[key]} className="w-3 h-3" />
                            Later · {g.later.length}
                          </button>
                          {showLater[key]
                            ? g.later.map((t) => (
                                <TaskLine
                                  key={t._id}
                                  task={t}
                                  project={g.project}
                                  subtasks={g.subtaskCount.get(String(t._id)) || 0}
                                  dayItems={dayItems}
                                  onToggle={onToggleTask}
                                />
                              ))
                            : null}
                        </>
                      ) : null}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>
            );
          })
        ) : (
          <p className="px-3 py-6 text-center text-xs text-fg-subtle">
            {query ? `No pending task matches “${query}”.` : projects.length ? "No pending tasks. Add one above." : "Create a project in Tasks first."}
          </p>
        )}
      </div>
    </aside>
  );
}
