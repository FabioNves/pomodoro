"use client";

// The project "⋮" modal: three tabs for the project itself, its milestones
// (create manually or with AI, edit, reorder, status, complete, delete) and
// its tasks (move between milestones, suggest tasks per milestone).

import React, { useEffect, useMemo, useState } from "react";
import ModalShell from "@/components/planner/ModalShell";
import SuggestDialog from "@/components/planner/SuggestDialog";
import {
  IconSparkle,
  MilestoneMeta,
  MilestoneToggle,
  ProgressBar,
  StatusPill,
} from "@/components/planner/MilestoneBits";
import { PROJECT_COLORS, getProjectColorMeta } from "@/lib/projectColors";
import {
  MILESTONE_STATUSES,
  compareMilestones,
  idOf,
  isInvalidRange,
  milestoneProgress,
  toDateInput,
} from "@/lib/milestones";
import { compareTasksByOrder } from "@/components/planner/TaskRow";
import { Locked } from "@/components/access/Gate";

const TABS = [
  { key: "project", label: "Project" },
  { key: "milestones", label: "Milestones" },
  { key: "tasks", label: "Tasks" },
];

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-sm outline-none focus:ring-2 focus:ring-focus/40";
const selectClass =
  "px-2 py-1 rounded-md bg-surface-2 border border-edge text-xs text-fg outline-none";

function IconGrip({ className = "" }) {
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

/* ── Project tab ─────────────────────────────────────── */

function ProjectTab({ project, milestones, tasks, actions, onClose }) {
  const [name, setName] = useState(project.name || "");
  const [description, setDescription] = useState(project.description || "");
  const [startDate, setStartDate] = useState(toDateInput(project.startDate));
  const [endDate, setEndDate] = useState(toDateInput(project.endDate));
  const [saving, setSaving] = useState(false);
  const badRange = isInvalidRange(startDate, endDate);
  const dirty =
    name.trim() !== (project.name || "") ||
    description.trim() !== (project.description || "") ||
    startDate !== toDateInput(project.startDate) ||
    endDate !== toDateInput(project.endDate);

  const save = async () => {
    if (!name.trim() || badRange) return;
    setSaving(true);
    try {
      await actions.updateProject(project, {
        name: name.trim(),
        description: description.trim(),
        startDate: startDate || null,
        endDate: endDate || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={80} />
      </div>
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="What is this project about?"
          className={`${inputClass} resize-y`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="project-start-date" className="block text-xs font-medium text-fg-muted mb-1">
            Start date
          </label>
          <input
            id="project-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="project-end-date" className="block text-xs font-medium text-fg-muted mb-1">
            End date
          </label>
          <input
            id="project-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
            min={startDate || undefined}
          />
        </div>
        {badRange ? (
          <p className="col-span-2 text-xs text-danger">The end date is before the start date.</p>
        ) : (
          <p className="col-span-2 text-xs text-fg-subtle">
            Shown on the timeline. Leave empty to span the project&apos;s dated milestones and tasks.
          </p>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">Header colour</label>
        <div className="flex gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`w-6 h-6 rounded-full ${c.swatchClass} border-2 transition-transform hover:scale-105 ${
                project.headerColor === c.key ? "border-fg" : "border-transparent"
              }`}
              aria-label={c.label}
              aria-pressed={project.headerColor === c.key}
              onClick={() => actions.updateProject(project, { headerColor: c.key })}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-xs text-fg-subtle">
          {milestones.length} milestone{milestones.length === 1 ? "" : "s"} · {tasks.filter((t) => !t.parentTask).length} tasks
        </div>
        <button
          type="button"
          className="px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm disabled:opacity-50"
          onClick={save}
          disabled={!dirty || !name.trim() || badRange || saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
      <div className="border-t border-edge pt-4">
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-danger/30 text-danger text-sm hover:bg-danger-soft"
          onClick={async () => {
            const ok = await actions.deleteProject(project);
            if (ok) onClose?.();
          }}
        >
          Delete project
        </button>
        <p className="text-xs text-fg-subtle mt-1.5">Deletes its milestones and tasks too.</p>
      </div>
    </div>
  );
}

/* ── Milestones tab ──────────────────────────────────── */

function MilestoneForm({ initial, onSubmit, onCancel, submitLabel = "Save" }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [status, setStatus] = useState(initial?.status || "planned");
  const [startDate, setStartDate] = useState(toDateInput(initial?.startDate));
  const [endDate, setEndDate] = useState(toDateInput(initial?.endDate));
  const [busy, setBusy] = useState(false);
  const badRange = isInvalidRange(startDate, endDate);

  return (
    <form
      className="rounded-xl border border-edge bg-surface-2/60 p-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || badRange) return;
        setBusy(true);
        try {
          await onSubmit({
            name: name.trim(),
            description: description.trim(),
            status,
            startDate: startDate || null,
            endDate: endDate || null,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Milestone name"
        className={inputClass}
        maxLength={80}
        autoFocus
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        maxLength={500}
        className={`${inputClass} resize-y`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            {MILESTONE_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
          Start
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={selectClass}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
          End
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={selectClass}
            min={startDate || undefined}
          />
        </label>
        {badRange ? (
          <span className="text-xs text-danger">End is before start.</span>
        ) : null}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-surface-2 border border-edge text-fg text-sm hover:bg-surface-hover"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-fg text-sm disabled:opacity-50"
            disabled={!name.trim() || badRange || busy}
          >
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

let dragId = null;

function MilestonesTab({ project, milestones, tasks, actions, onSuggestMilestones, onSuggestTasks }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const sorted = useMemo(() => [...milestones].sort(compareMilestones), [milestones]);

  const reorder = (fromId, toId) => {
    if (fromId === toId) return;
    const ids = sorted.map((m) => String(m._id));
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, fromId);
    actions.reorderMilestones(project._id, ids);
  };
  const moveBy = (id, delta) => {
    const ids = sorted.map((m) => String(m._id));
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    actions.reorderMilestones(project._id, ids);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm font-medium hover:bg-surface-hover"
          onClick={() => {
            setEditingId(null);
            setAdding(true);
          }}
        >
          + Add milestone
        </button>
        <Locked feature="ai_project_planning">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-soft text-primary text-sm font-medium hover:bg-surface-hover"
            onClick={onSuggestMilestones}
          >
            <IconSparkle className="w-4 h-4" />
            Suggest milestones
          </button>
        </Locked>
      </div>

      {adding ? (
        <MilestoneForm
          submitLabel="Add milestone"
          onCancel={() => setAdding(false)}
          onSubmit={async (data) => {
            await actions.createMilestone(project._id, data);
            setAdding(false);
          }}
        />
      ) : null}

      {sorted.length ? (
        <div className="space-y-1.5">
          {sorted.map((m, idx) => {
            const id = String(m._id);
            const progress = milestoneProgress(m, tasks);
            const done = m.status === "completed";
            if (editingId === id) {
              return (
                <MilestoneForm
                  key={id}
                  initial={m}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (data) => {
                    await actions.updateMilestone(m, data);
                    setEditingId(null);
                  }}
                />
              );
            }
            return (
              <div
                key={id}
                className="group rounded-xl border border-edge bg-surface-2/40 px-2.5 py-2"
                draggable
                onDragStart={(e) => {
                  dragId = id;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", `milestone:${id}`);
                }}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  const from = dragId;
                  dragId = null;
                  reorder(from, id);
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="cursor-grab text-fg-subtle mt-1 shrink-0" aria-hidden="true">
                    <IconGrip className="w-4 h-4" />
                  </span>
                  <div className="mt-0.5">
                    <MilestoneToggle
                      completed={done}
                      onToggle={() =>
                        actions.updateMilestone(m, { status: done ? "active" : "completed" })
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-fg-subtle shrink-0">{idx + 1}.</span>
                      <div
                        className={`flex-1 min-w-0 text-sm font-semibold truncate ${
                          done ? "text-fg-subtle line-through" : "text-fg"
                        }`}
                      >
                        {m.name}
                      </div>
                      <select
                        value={m.status}
                        onChange={(e) => actions.updateMilestone(m, { status: e.target.value })}
                        className={selectClass}
                        aria-label="Status"
                      >
                        {MILESTONE_STATUSES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {m.description ? (
                      <div className="text-xs text-fg-muted mt-0.5 line-clamp-2">{m.description}</div>
                    ) : null}
                    <div className="flex items-center gap-2 mt-1.5">
                      <ProgressBar percent={progress.percent} status={m.status} className="flex-1" />
                      <span className="text-[10px] text-fg-subtle w-8 text-right tabular-nums">
                        {progress.percent}%
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <MilestoneMeta milestone={m} progress={progress} />
                      <label className="flex items-center gap-1 text-[11px] text-fg-subtle">
                        Start
                        <input
                          type="date"
                          value={toDateInput(m.startDate)}
                          max={toDateInput(m.endDate) || undefined}
                          onChange={(e) =>
                            actions.updateMilestone(m, { startDate: e.target.value || null })
                          }
                          className="px-1.5 py-0.5 rounded bg-surface-2 border border-edge text-[11px] text-fg outline-none"
                          aria-label="Start date"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-fg-subtle">
                        End
                        <input
                          type="date"
                          value={toDateInput(m.endDate)}
                          min={toDateInput(m.startDate) || undefined}
                          onChange={(e) =>
                            actions.updateMilestone(m, { endDate: e.target.value || null })
                          }
                          className="px-1.5 py-0.5 rounded bg-surface-2 border border-edge text-[11px] text-fg outline-none"
                          aria-label="End date"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-1.5 -ml-1">
                      <button
                        type="button"
                        className="px-2 py-1 rounded-md text-xs text-fg-muted hover:bg-surface-hover hover:text-fg"
                        onClick={() => {
                          setAdding(false);
                          setEditingId(id);
                        }}
                      >
                        Edit
                      </button>
                      <Locked feature="ai_project_planning">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary hover:bg-surface-hover"
                          onClick={() => onSuggestTasks(m)}
                        >
                          <IconSparkle className="w-3.5 h-3.5" />
                          Suggest tasks
                        </button>
                      </Locked>
                      <button
                        type="button"
                        className="px-2 py-1 rounded-md text-xs text-fg-muted hover:bg-surface-hover hover:text-fg disabled:opacity-30"
                        onClick={() => moveBy(id, -1)}
                        disabled={idx === 0}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded-md text-xs text-fg-muted hover:bg-surface-hover hover:text-fg disabled:opacity-30"
                        onClick={() => moveBy(id, 1)}
                        disabled={idx === sorted.length - 1}
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        className="ml-auto px-2 py-1 rounded-md text-xs text-danger hover:bg-danger-soft"
                        onClick={() => actions.deleteMilestone(m)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : !adding ? (
        <div className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-fg-subtle">
          No milestones yet. Add one manually or let the AI suggest a structure.
        </div>
      ) : null}
    </div>
  );
}

/* ── Tasks tab ───────────────────────────────────────── */

function TasksTab({ milestones, tasks, actions, onSuggestTasks }) {
  const sorted = useMemo(() => [...milestones].sort(compareMilestones), [milestones]);
  const [showCompleted, setShowCompleted] = useState(false);
  const topLevel = useMemo(
    () =>
      tasks
        .filter((t) => !t.parentTask && (showCompleted || !t.completed))
        .sort(compareTasksByOrder),
    [tasks, showCompleted],
  );
  const groups = useMemo(() => {
    const map = new Map();
    for (const t of topLevel) {
      const key = idOf(t.milestone) || "";
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [topLevel]);

  const sections = [
    ...sorted.map((m) => ({ key: String(m._id), milestone: m, tasks: groups.get(String(m._id)) || [] })),
    { key: "", milestone: null, tasks: groups.get("") || [] },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-fg-subtle">
          Pick a milestone for each task. Subtasks follow their parent.
        </p>
        <label className="flex items-center gap-1.5 text-xs text-fg-muted whitespace-nowrap">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed
        </label>
      </div>
      {sections.map((s) => (
        <div key={s.key || "unassigned"}>
          <div className="flex items-center gap-2 py-1">
            <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider truncate">
              {s.milestone ? s.milestone.name : "Unassigned"}
            </span>
            <span className="text-[11px] text-fg-subtle">({s.tasks.length})</span>
            <div className="flex-1 h-px bg-edge" />
            {s.milestone ? (
              <Locked feature="ai_project_planning">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary-hover"
                  onClick={() => onSuggestTasks(s.milestone)}
                >
                  <IconSparkle className="w-3 h-3" />
                  Suggest tasks
                </button>
              </Locked>
            ) : null}
          </div>
          {s.tasks.length ? (
            <div className="space-y-0.5">
              {s.tasks.map((t) => (
                <div
                  key={t._id}
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-hover"
                >
                  <div
                    className={`flex-1 min-w-0 text-sm truncate ${
                      t.completed ? "text-fg-subtle line-through" : "text-fg"
                    }`}
                  >
                    {t.title}
                  </div>
                  <select
                    value={idOf(t.milestone) || ""}
                    onChange={(e) => actions.setTaskMilestone(t, e.target.value || null)}
                    className={selectClass}
                    aria-label={`Milestone for ${t.title}`}
                  >
                    <option value="">Unassigned</option>
                    {sorted.map((m) => (
                      <option key={m._id} value={String(m._id)}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 py-1.5 text-xs text-fg-subtle italic">No tasks</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────── */

export default function ProjectManageModal({
  open,
  project,
  milestones = [],
  tasks = [],
  initialTab = "project",
  onClose,
  actions,
}) {
  const [tab, setTab] = useState(initialTab);
  const [suggest, setSuggest] = useState(null); // { kind, milestone }

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab, project?._id]);

  if (!project) return null;
  const colorMeta = getProjectColorMeta(project.headerColor);

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        title={
          <span className="inline-flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${colorMeta.swatchClass}`} />
            {project.name}
          </span>
        }
        subtitle="Project, milestones and tasks"
        size="lg"
      >
        <div className="sticky top-0 z-10 bg-surface border-b border-edge px-5 pt-2">
          <div className="inline-flex gap-1 p-1 rounded-xl bg-surface-2 border border-edge mb-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key ? "bg-primary-soft text-primary" : "text-fg-muted hover:bg-surface-hover"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-4">
          {tab === "project" ? (
            <ProjectTab
              project={project}
              milestones={milestones}
              tasks={tasks}
              actions={actions}
              onClose={onClose}
            />
          ) : tab === "milestones" ? (
            <MilestonesTab
              project={project}
              milestones={milestones}
              tasks={tasks}
              actions={actions}
              onSuggestMilestones={() => setSuggest({ kind: "milestones" })}
              onSuggestTasks={(m) => setSuggest({ kind: "tasks", milestone: m })}
            />
          ) : (
            <TasksTab
              milestones={milestones}
              tasks={tasks}
              actions={actions}
              onSuggestTasks={(m) => setSuggest({ kind: "tasks", milestone: m })}
            />
          )}
        </div>
      </ModalShell>

      <SuggestDialog
        open={Boolean(suggest)}
        kind={suggest?.kind || "milestones"}
        project={project}
        milestone={suggest?.milestone || null}
        milestones={milestones}
        tasks={tasks}
        onClose={() => setSuggest(null)}
        onConfirm={(payload) =>
          suggest?.kind === "tasks"
            ? actions.addStructure(project._id, {
                milestoneId: suggest.milestone?._id || null,
                tasks: payload.tasks,
              })
            : actions.addStructure(project._id, { milestones: payload.milestones })
        }
      />
    </>
  );
}
