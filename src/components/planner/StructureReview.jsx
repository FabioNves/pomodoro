"use client";

// Review screen for suggested structure (from a template or the AI) before
// anything is created. Works with three shapes:
//   mode="structure"  — milestones, each with its tasks
//   mode="milestones" — milestones only
//   mode="tasks"      — tasks only
// Every item can be selected/unselected, renamed, removed, reordered (drag
// or the arrow buttons) and new ones added. The parent owns the draft and
// receives every change through onChange.

import React, { useState } from "react";

let keySeq = 0;
const nextKey = () => `d${Date.now().toString(36)}${(keySeq++).toString(36)}`;

/** Build a draft from template/AI milestones ([{name, description, tasks:[{title}]}]). */
export function makeMilestoneDraft(milestones = []) {
  return milestones.map((m) => ({
    key: nextKey(),
    name: m.name || "",
    description: m.description || "",
    startDate: m.startDate || "",
    endDate: m.endDate || "",
    selected: true,
    tasks: makeTaskDraft(m.tasks || []),
  }));
}

/** Build a draft from tasks ([{title}] or plain strings). */
export function makeTaskDraft(tasks = []) {
  return tasks.map((t) => ({
    key: nextKey(),
    title: typeof t === "string" ? t : t.title || "",
    selected: true,
  }));
}

/** Selected milestones (with their selected tasks) as the structure API expects. */
export function selectedMilestones(draft = []) {
  return draft
    .filter((m) => m.selected && m.name.trim())
    .map((m) => ({
      name: m.name.trim(),
      description: (m.description || "").trim(),
      ...(m.startDate ? { startDate: m.startDate } : {}),
      ...(m.endDate ? { endDate: m.endDate } : {}),
      tasks: selectedTasks(m.tasks),
    }));
}

export function selectedTasks(draft = []) {
  return draft
    .filter((t) => t.selected && t.title.trim())
    .map((t) => ({ title: t.title.trim() }));
}

export function countSelected(draft = [], mode = "structure") {
  if (mode === "tasks") return { tasks: selectedTasks(draft).length };
  const ms = selectedMilestones(draft);
  return {
    milestones: ms.length,
    tasks: ms.reduce((n, m) => n + m.tasks.length, 0),
  };
}

function move(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length)
    return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

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

function IconArrow({ up, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={up ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
      />
    </svg>
  );
}

function IconX({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`w-4.5 h-4.5 w-[18px] h-[18px] shrink-0 rounded border flex items-center justify-center transition-colors ${
        checked ? "bg-primary border-primary" : "bg-transparent border-edge-strong"
      }`}
    >
      {checked ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary-fg)"
          strokeWidth="3"
          className="w-3 h-3"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : null}
    </button>
  );
}

function RowControls({ index, count, onUp, onDown, onRemove, small }) {
  const btn = `p-1 rounded text-fg-subtle hover:text-fg hover:bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent ${
    small ? "" : ""
  }`;
  const icon = small ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center shrink-0 opacity-70 group-hover:opacity-100">
      <button type="button" className={btn} onClick={onUp} disabled={index === 0} aria-label="Move up">
        <IconArrow up className={icon} />
      </button>
      <button
        type="button"
        className={btn}
        onClick={onDown}
        disabled={index === count - 1}
        aria-label="Move down"
      >
        <IconArrow className={icon} />
      </button>
      <button type="button" className={`${btn} hover:text-danger`} onClick={onRemove} aria-label="Remove">
        <IconX className={icon} />
      </button>
    </div>
  );
}

function AddRow({ placeholder, onAdd, className = "" }) {
  const [value, setValue] = useState("");
  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue("");
  };
  return (
    <div className={`flex gap-2 ${className}`}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm outline-none focus:ring-2 focus:ring-focus/40"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim()}
        className="px-2.5 py-1.5 rounded-lg bg-surface-2 border border-edge text-sm font-medium hover:bg-surface-hover disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}

/* Drag state is module-local: only one drag happens at a time. */
let dragPayload = null;

function useDragReorder(listId, onMove) {
  return {
    onDragStart: (index) => (e) => {
      dragPayload = { listId, index };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `${listId}:${index}`);
    },
    onDragOver: (e) => {
      if (dragPayload?.listId !== listId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    onDrop: (index) => (e) => {
      if (dragPayload?.listId !== listId) return;
      e.preventDefault();
      e.stopPropagation();
      const from = dragPayload.index;
      dragPayload = null;
      if (from !== index) onMove(from, index);
    },
  };
}

function TaskDraftList({ tasks, onChange, listId, placeholder = "Add your own task" }) {
  const update = (idx, patch) =>
    onChange(tasks.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  const remove = (idx) => onChange(tasks.filter((_, i) => i !== idx));
  const moveTo = (from, to) => onChange(move(tasks, from, to));
  const drag = useDragReorder(listId, moveTo);

  return (
    <div className="space-y-0.5">
      {tasks.map((t, idx) => (
        <div
          key={t.key}
          className={`group flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-surface-hover ${
            t.selected ? "" : "opacity-60"
          }`}
          draggable
          onDragStart={drag.onDragStart(idx)}
          onDragOver={drag.onDragOver}
          onDrop={drag.onDrop(idx)}
        >
          <span className="cursor-grab text-fg-subtle shrink-0" aria-hidden="true">
            <IconGrip className="w-3.5 h-3.5" />
          </span>
          <Checkbox
            checked={t.selected}
            onChange={() => update(idx, { selected: !t.selected })}
            label={t.selected ? "Unselect task" : "Select task"}
          />
          <input
            value={t.title}
            onChange={(e) => update(idx, { title: e.target.value })}
            className={`flex-1 min-w-0 bg-transparent text-sm outline-none border-b border-transparent focus:border-edge-strong py-0.5 ${
              t.selected ? "text-fg" : "text-fg-muted line-through"
            }`}
            aria-label="Task name"
          />
          <RowControls
            small
            index={idx}
            count={tasks.length}
            onUp={() => moveTo(idx, idx - 1)}
            onDown={() => moveTo(idx, idx + 1)}
            onRemove={() => remove(idx)}
          />
        </div>
      ))}
      <AddRow
        placeholder={placeholder}
        className="pt-1 pl-6"
        onAdd={(title) => onChange([...tasks, ...makeTaskDraft([title])])}
      />
    </div>
  );
}

export default function StructureReview({
  mode = "structure",
  items = [],
  onChange,
  showDescriptions = true,
  showDates = false,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  if (mode === "tasks") {
    return (
      <div>
        <TaskDraftList tasks={items} onChange={onChange} listId="tasks-root" />
      </div>
    );
  }

  const withTasks = mode === "structure";
  const update = (idx, patch) =>
    onChange(items.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const moveTo = (from, to) => onChange(move(items, from, to));
  const drag = useDragReorder("milestones-root", moveTo);
  const toggleExpanded = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-2">
      {items.map((m, idx) => {
        const selectedTaskCount = (m.tasks || []).filter((t) => t.selected).length;
        const open = withTasks && (expanded.has(m.key) || items.length <= 3);
        return (
          <div
            key={m.key}
            className={`group rounded-xl border border-edge bg-surface-2/60 ${
              m.selected ? "" : "opacity-60"
            }`}
            draggable
            onDragStart={drag.onDragStart(idx)}
            onDragOver={drag.onDragOver}
            onDrop={drag.onDrop(idx)}
          >
            <div className="flex items-start gap-2 px-2.5 py-2">
              <span className="cursor-grab text-fg-subtle shrink-0 mt-1" aria-hidden="true">
                <IconGrip className="w-4 h-4" />
              </span>
              <div className="mt-0.5">
                <Checkbox
                  checked={m.selected}
                  onChange={() => update(idx, { selected: !m.selected })}
                  label={m.selected ? "Unselect milestone" : "Select milestone"}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-fg-subtle w-5 shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    value={m.name}
                    onChange={(e) => update(idx, { name: e.target.value })}
                    className={`flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-edge-strong py-0.5 ${
                      m.selected ? "text-fg" : "text-fg-muted line-through"
                    }`}
                    aria-label="Milestone name"
                    placeholder="Milestone name"
                  />
                </div>
                {showDescriptions ? (
                  <input
                    value={m.description || ""}
                    onChange={(e) => update(idx, { description: e.target.value })}
                    className="w-full mt-0.5 ml-5 pr-5 bg-transparent text-xs text-fg-muted outline-none border-b border-transparent focus:border-edge-strong py-0.5"
                    aria-label="Milestone description"
                    placeholder="Description (optional)"
                  />
                ) : null}
                {showDates ? (
                  <div className="mt-1 ml-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
                    <label className="flex items-center gap-1.5">
                      Start
                      <input
                        type="date"
                        value={m.startDate || ""}
                        max={m.endDate || undefined}
                        onChange={(e) => update(idx, { startDate: e.target.value })}
                        className="px-2 py-0.5 rounded-md bg-surface border border-edge text-xs text-fg outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1.5">
                      End
                      <input
                        type="date"
                        value={m.endDate || ""}
                        min={m.startDate || undefined}
                        onChange={(e) => update(idx, { endDate: e.target.value })}
                        className="px-2 py-0.5 rounded-md bg-surface border border-edge text-xs text-fg outline-none"
                      />
                    </label>
                  </div>
                ) : null}
                {withTasks ? (
                  <button
                    type="button"
                    className="mt-1 ml-5 text-xs text-primary hover:text-primary-hover font-medium"
                    onClick={() => toggleExpanded(m.key)}
                  >
                    {open ? "Hide tasks" : "Show tasks"} ({selectedTaskCount}/{(m.tasks || []).length})
                  </button>
                ) : null}
              </div>
              <RowControls
                index={idx}
                count={items.length}
                onUp={() => moveTo(idx, idx - 1)}
                onDown={() => moveTo(idx, idx + 1)}
                onRemove={() => remove(idx)}
              />
            </div>
            {withTasks && open ? (
              <div className="px-3 pb-2 pl-10">
                <TaskDraftList
                  tasks={m.tasks || []}
                  onChange={(tasks) => update(idx, { tasks })}
                  listId={`tasks-${m.key}`}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      <AddRow
        placeholder="Add your own milestone"
        onAdd={(name) => onChange([...items, ...makeMilestoneDraft([{ name }])])}
      />
    </div>
  );
}
