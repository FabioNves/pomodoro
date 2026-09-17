"use client";

// Project page: project information, then its milestones, then the tasks
// grouped under their milestone (plus an "Unassigned" section). Tasks can be
// dragged onto a milestone group or moved through their menu.

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AddTaskModal,
  IconChevron,
  IconDotsVertical,
  TaskRow,
  compareTasksByOrder,
} from "@/components/planner/TaskRow";
import {
  IconFlag,
  IconSparkle,
  MilestoneMeta,
  MilestoneToggle,
  ProgressBar,
  StatusPill,
} from "@/components/planner/MilestoneBits";
import { getProjectColorMeta } from "@/lib/projectColors";
import { Locked } from "@/components/access/Gate";
import {
  compareMilestones,
  formatDateRange,
  idOf,
  milestoneProgress,
  projectProgress,
} from "@/lib/milestones";

function MilestoneCard({ milestone, progress, onToggleComplete, onSuggestTasks, onManage, onJump }) {
  const done = milestone.status === "completed";
  return (
    <div className="rounded-xl border border-edge bg-surface px-3 py-2.5 flex items-start gap-3">
      <div className="mt-0.5">
        <MilestoneToggle completed={done} onToggle={() => onToggleComplete(milestone)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`flex-1 min-w-0 text-left text-sm font-semibold truncate hover:underline ${
              done ? "text-fg-subtle line-through" : "text-fg"
            }`}
            onClick={onJump}
            title="Jump to tasks"
          >
            {milestone.name}
          </button>
          <StatusPill status={milestone.status} />
          <button
            type="button"
            className="text-fg-subtle hover:text-fg p-0.5 rounded"
            aria-label="Milestone options"
            onClick={onManage}
          >
            <IconDotsVertical className="w-4 h-4" />
          </button>
        </div>
        {milestone.description ? (
          <div className="text-xs text-fg-muted mt-0.5 line-clamp-2">{milestone.description}</div>
        ) : null}
        <div className="flex items-center gap-2 mt-1.5">
          <ProgressBar percent={progress.percent} status={milestone.status} className="flex-1" />
          <span className="text-[10px] text-fg-subtle w-8 text-right tabular-nums">{progress.percent}%</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <MilestoneMeta milestone={milestone} progress={progress} />
          <Locked feature="ai_project_planning">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover"
              onClick={() => onSuggestTasks(milestone)}
            >
              <IconSparkle className="w-3 h-3" />
              Suggest tasks
            </button>
          </Locked>
        </div>
      </div>
    </div>
  );
}

function TaskGroup({
  project,
  milestone,
  tasks,
  subtasksByParent,
  milestones,
  handlers,
  onAddTask,
  onSuggestTasks,
  anchorId,
}) {
  const [completedOpen, setCompletedOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const active = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);
  const milestoneId = milestone ? String(milestone._id) : null;

  return (
    <section
      id={anchorId}
      className={`rounded-2xl border bg-surface transition-colors ${
        dragOver ? "border-primary bg-primary-soft/40" : "border-edge"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId.includes(":")) return;
        handlers.onDropTask(draggedId, milestoneId);
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
        <IconFlag className={`w-3.5 h-3.5 shrink-0 ${milestone ? "text-primary" : "text-fg-subtle"}`} />
        <div className="flex-1 min-w-0 text-sm font-semibold text-fg truncate">
          {milestone ? milestone.name : "Unassigned"}
        </div>
        <span className="text-[11px] text-fg-subtle">
          {active.length} open{completed.length ? ` · ${completed.length} done` : ""}
        </span>
        {milestone ? <StatusPill status={milestone.status} /> : null}
      </div>
      <div className="px-2 py-2">
        <div className="flex items-center gap-3 px-2 pb-1">
          <button
            type="button"
            className="text-sm text-primary hover:text-primary-hover font-medium"
            onClick={() => onAddTask(milestone)}
          >
            + Add a task
          </button>
          {milestone ? (
            <Locked feature="ai_project_planning">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-primary"
                onClick={() => onSuggestTasks(milestone)}
              >
                <IconSparkle className="w-3.5 h-3.5" />
                Suggest
              </button>
            </Locked>
          ) : null}
        </div>
        <div className="space-y-0.5 min-h-[28px]">
          {active.length ? (
            active.map((t) => (
              <TaskRow
                key={t._id}
                task={t}
                subtasks={subtasksByParent.get(String(t._id)) || []}
                onToggle={handlers.onToggleTask}
                onCreateSubtask={(parent, title) => handlers.onCreateSubtask(project, parent, title)}
                onDeleteTask={handlers.onDeleteTask}
                onMoveTask={handlers.onMoveTask}
                onSetScheduledDate={handlers.onSetScheduledDate}
                onSetDates={handlers.onSetTaskDates}
                onSetMilestone={handlers.onSetTaskMilestone}
                onRenameTask={handlers.onRenameTask}
                milestones={milestones}
                projectId={project._id}
                scheduledForLater={!!t.scheduledForLater}
              />
            ))
          ) : (
            <div className="px-4 py-2 text-xs text-fg-subtle italic">
              {milestone ? "No open tasks. Drop a task here to move it." : "No unassigned tasks"}
            </div>
          )}
        </div>
        {completed.length ? (
          <div className="px-2 pt-1">
            <button
              type="button"
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-surface-hover text-xs text-fg-muted"
              onClick={() => setCompletedOpen((v) => !v)}
            >
              <span>Completed ({completed.length})</span>
              <IconChevron open={completedOpen} className="w-3.5 h-3.5" />
            </button>
            <AnimatePresence initial={false}>
              {completedOpen ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  {completed.map((t) => (
                    <TaskRow
                      key={t._id}
                      task={t}
                      subtasks={subtasksByParent.get(String(t._id)) || []}
                      onToggle={handlers.onToggleTask}
                      onCreateSubtask={(parent, title) => handlers.onCreateSubtask(project, parent, title)}
                      onDeleteTask={handlers.onDeleteTask}
                      onRenameTask={handlers.onRenameTask}
                    />
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ProjectPageView({
  project,
  projects = [],
  milestones = [],
  tasks = [],
  handlers,
  onSelectProject,
  onManage,
  onSuggestMilestones,
  onSuggestTasks,
  onAddTask,
  onUpdateMilestone,
}) {
  const [addTarget, setAddTarget] = useState(null); // { milestone } | null
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");

  const sortedMilestones = useMemo(() => [...milestones].sort(compareMilestones), [milestones]);

  const { groups, subtasksByParent } = useMemo(() => {
    const children = new Map();
    for (const t of tasks) {
      if (!t.parentTask) continue;
      const key = idOf(t.parentTask);
      const list = children.get(key) || [];
      list.push(t);
      children.set(key, list);
    }
    for (const [k, list] of children.entries()) children.set(k, [...list].sort(compareTasksByOrder));
    const byMilestone = new Map();
    for (const t of tasks) {
      if (t.parentTask) continue;
      const key = idOf(t.milestone) || "";
      const list = byMilestone.get(key) || [];
      list.push(t);
      byMilestone.set(key, list);
    }
    for (const [k, list] of byMilestone.entries()) byMilestone.set(k, [...list].sort(compareTasksByOrder));
    return { groups: byMilestone, subtasksByParent: children };
  }, [tasks]);

  if (!project) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm font-semibold text-fg-subtle uppercase tracking-wider mb-3">
            Pick a project
          </h2>
          {projects.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {projects.map((p) => {
                const color = getProjectColorMeta(p.headerColor);
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => onSelectProject?.(p)}
                    className={`text-left rounded-xl border bg-surface hover:bg-surface-hover px-3 py-2.5 ${color.borderClass}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${color.swatchClass}`} />
                      <span className="font-semibold text-fg truncate">{p.name}</span>
                    </div>
                    {p.description ? (
                      <div className="text-xs text-fg-muted mt-1 line-clamp-2">{p.description}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-fg-muted">Create a project to start adding tasks.</div>
          )}
        </div>
      </div>
    );
  }

  const color = getProjectColorMeta(project.headerColor);
  const overall = projectProgress(sortedMilestones, tasks);
  const doneMilestones = sortedMilestones.filter((m) => m.status === "completed").length;
  const projectRange = formatDateRange(project.startDate, project.endDate);
  const anchorFor = (m) => `milestone-${m ? m._id : "unassigned"}`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        {/* Project information */}
        <header className={`rounded-2xl border ${color.borderClass} bg-surface overflow-hidden`}>
          <div className={`px-4 py-3 ${color.headerClass} flex items-start gap-3`}>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-fg truncate">{project.name}</h2>
              {project.description ? (
                <p className="text-sm text-fg-muted mt-0.5 whitespace-pre-wrap">{project.description}</p>
              ) : (
                <button
                  type="button"
                  className="text-xs text-fg-subtle hover:text-fg mt-0.5"
                  onClick={() => onManage?.("project")}
                >
                  Add a description…
                </button>
              )}
            </div>
            <button
              type="button"
              className="text-fg-subtle hover:text-fg p-1 rounded-lg hover:bg-surface/50"
              aria-label="Project menu"
              onClick={() => onManage?.("project")}
            >
              <IconDotsVertical className="w-5 h-5" />
            </button>
          </div>
          <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
            <div className="flex items-center gap-2 min-w-[160px] flex-1">
              <ProgressBar percent={overall.percent} className="flex-1" />
              <span className="tabular-nums w-8 text-right">{overall.percent}%</span>
            </div>
            <span>
              {sortedMilestones.length
                ? `${doneMilestones}/${sortedMilestones.length} milestones`
                : `${overall.done}/${overall.total} tasks`}
            </span>
            {projectRange ? (
              <button
                type="button"
                className="hover:text-fg"
                onClick={() => onManage?.("project")}
                title="Change the project dates"
              >
                {projectRange}
              </button>
            ) : (
              <button
                type="button"
                className="text-fg-subtle hover:text-fg"
                onClick={() => onManage?.("project")}
              >
                Set dates…
              </button>
            )}
          </div>
        </header>

        {/* Milestones */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider">Milestones</h3>
            <div className="flex-1 h-px bg-edge" />
            <button
              type="button"
              className="text-xs font-medium text-fg-muted hover:text-fg"
              onClick={() => onManage?.("milestones")}
            >
              + Add
            </button>
            <Locked feature="ai_project_planning">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
                onClick={onSuggestMilestones}
              >
                <IconSparkle className="w-3.5 h-3.5" />
                Suggest milestones
              </button>
            </Locked>
          </div>
          {sortedMilestones.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {sortedMilestones.map((m) => (
                <MilestoneCard
                  key={m._id}
                  milestone={m}
                  progress={milestoneProgress(m, tasks)}
                  onToggleComplete={(ms) =>
                    onUpdateMilestone(ms, { status: ms.status === "completed" ? "active" : "completed" })
                  }
                  onSuggestTasks={onSuggestTasks}
                  onManage={() => onManage?.("milestones")}
                  onJump={() => {
                    const el = document.getElementById(anchorFor(m));
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-edge px-4 py-5 text-center text-sm text-fg-subtle">
              No milestones yet. Add them manually or let the AI suggest a structure for this project.
            </div>
          )}
        </section>

        {/* Tasks grouped by milestone */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider">Tasks</h3>
            <div className="flex-1 h-px bg-edge" />
            <button
              type="button"
              className="text-xs font-medium text-fg-muted hover:text-fg"
              onClick={() => onManage?.("tasks")}
            >
              Move tasks between milestones
            </button>
          </div>
          {sortedMilestones.map((m) => (
            <TaskGroup
              key={m._id}
              anchorId={anchorFor(m)}
              project={project}
              milestone={m}
              tasks={groups.get(String(m._id)) || []}
              subtasksByParent={subtasksByParent}
              milestones={sortedMilestones}
              handlers={handlers}
              onAddTask={(ms) => {
                setNewTitle("");
                setNewDate("");
                setAddTarget({ milestone: ms });
              }}
              onSuggestTasks={onSuggestTasks}
            />
          ))}
          <TaskGroup
            anchorId={anchorFor(null)}
            project={project}
            milestone={null}
            tasks={groups.get("") || []}
            subtasksByParent={subtasksByParent}
            milestones={sortedMilestones}
            handlers={handlers}
            onAddTask={() => {
              setNewTitle("");
              setNewDate("");
              setAddTarget({ milestone: null });
            }}
            onSuggestTasks={onSuggestTasks}
          />
        </section>
      </div>

      <AddTaskModal
        open={Boolean(addTarget)}
        projectName={project.name}
        milestoneName={addTarget?.milestone?.name || null}
        title={newTitle}
        setTitle={setNewTitle}
        date={newDate}
        setDate={setNewDate}
        onCancel={() => setAddTarget(null)}
        onSubmit={() => {
          const title = newTitle.trim();
          if (!title) return;
          onAddTask(project, title, newDate || null, addTarget?.milestone?._id || null);
          setAddTarget(null);
        }}
      />
    </div>
  );
}
