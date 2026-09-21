"use client";

// One work item, opened from anywhere (a row, a next action, a blocker, the
// activity list): its status, exactly what blocks it, what it unlocks, its
// notes, and its prerequisites, which can be rewired. Every other work item
// named in here is a link, so a chain of blockers can be followed to the
// thing that can actually be started.

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ModalShell from "@/components/planner/ModalShell";
import Dropdown from "@/components/ui/Dropdown";
import { LIMITS, areasOf, phaseMeta, phaseNumber, statusMeta } from "@/lib/business/phases";
import { blockersOf, dependentsOf, prerequisitesOf, rootBlockersOf, wouldCreateCycle } from "@/lib/business/engine";
import {
  ActionButton,
  Field,
  StatusGlyph,
  StatusPill,
  inputClass,
  statusTextClass,
  IconExternal,
  IconLock,
  IconTrash,
  IconUnlock,
  IconX,
} from "@/components/business/businessUi";

const STATUS_CHOICES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

/** Another work item, as a link to it. */
function ItemLink({ item, status, onOpen, onRemove = null, removeLabel }) {
  return (
    <li className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="min-w-0 flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-edge bg-surface-2 text-left hover:border-edge-strong transition-colors"
      >
        <StatusGlyph status={status} className={`w-3.5 h-3.5 shrink-0 ${statusTextClass(status)}`} />
        <span className={`min-w-0 flex-1 truncate text-sm ${status === "completed" ? "text-fg-subtle line-through" : "text-fg"}`}>{item.title}</span>
        <span className="shrink-0 text-[11px] text-fg-subtle">
          {phaseNumber(item.phase)} {phaseMeta(item.phase)?.name}
        </span>
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label={removeLabel}
          title={removeLabel}
          className="shrink-0 p-1.5 rounded-md text-fg-subtle hover:text-danger hover:bg-danger-soft transition-colors"
        >
          <IconX className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </li>
  );
}

function SectionLabel({ children, count }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
      {children}
      {typeof count === "number" ? <span className="ml-1 font-medium tabular-nums">({count})</span> : null}
    </h4>
  );
}

export default function WorkItemDialog({
  item,
  items,
  dependencies,
  summary,
  onClose,
  onOpenItem,
  onSetStatus,
  onUpdate,
  onDelete,
  onAddDependency,
  onRemoveDependency,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState("");

  // Reload the fields when another item is opened, not on every keystroke's
  // round trip through the parent.
  useEffect(() => {
    setTitle(item?.title || "");
    setDescription(item?.description || "");
    setNotes(item?.notes || "");
    setSaved("");
  }, [item?.id]);

  const graph = summary.graph;
  const status = item ? summary.statuses.get(item.id) : "not_started";
  const prerequisites = item ? prerequisitesOf(item.id, graph) : [];
  const blockers = item ? blockersOf(item.id, graph) : [];
  const unlocks = item ? dependentsOf(item.id, graph) : [];
  // Worth showing only when the direct blockers are themselves held up.
  const roots = item && blockers.some((b) => summary.statuses.get(b.id) === "blocked") ? rootBlockersOf(item.id, graph) : [];

  // Anything that would not send the dependencies round in a circle.
  const candidateGroups = useMemo(() => {
    if (!item) return [];
    const taken = new Set(graph.prerequisites.get(item.id) || []);
    return summary.phases
      .map((phase) => ({
        key: phase.key,
        label: `${phaseNumber(phase.key)} ${phase.name}`,
        options: items
          .filter((other) => other.phase === phase.key && other.id !== item.id && !taken.has(other.id))
          .filter((other) => !wouldCreateCycle(item.id, other.id, graph))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((other) => ({ value: other.id, label: other.title, hint: statusMeta(summary.statuses.get(other.id)).label })),
      }))
      .filter((group) => group.options.length);
  }, [item, items, summary, graph]);

  if (!item) return <ModalShell open={false} onClose={onClose} />;

  const commit = async (field, value, original) => {
    const next = field === "notes" ? value : value.trim();
    if (next === (original || "")) return;
    if (field === "title" && !next) return setTitle(original);
    const ok = await onUpdate(item.id, { [field]: next });
    setSaved(ok ? "Saved" : "");
  };

  const edgeTo = (prerequisite) => dependencies.find((d) => d.item === item.id && d.dependsOn === prerequisite.id);
  const blocked = status === "blocked";
  const areaOptions = [...new Set([...areasOf(item.phase, items, { withEmpty: true }), item.area])];

  return (
    <ModalShell
      open
      onClose={onClose}
      size="lg"
      title={item.title}
      subtitle={`${phaseNumber(item.phase)} ${phaseMeta(item.phase)?.name} · ${item.area}`}
      headerRight={<StatusPill status={status} className="mt-0.5" />}
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          <ActionButton tone="ghost" size="sm" Icon={IconTrash} onClick={() => onDelete(item)}>
            Delete
          </ActionButton>
          <div className="flex items-center gap-3">
            {saved ? <span className="text-xs text-success">{saved}</span> : null}
            <ActionButton tone="primary" onClick={onClose}>
              Done
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="px-5 py-4 space-y-5" data-testid="item-dialog" data-item-status={status}>
        {/* Status */}
        <div className="space-y-2">
          <SectionLabel>Status</SectionLabel>
          <div role="radiogroup" aria-label="Status" className="inline-flex flex-wrap items-center gap-0.5 bg-surface-2/80 p-0.5 rounded-lg border border-edge">
            {STATUS_CHOICES.map((choice) => {
              const active = item.status === choice.value;
              const locked = blocked && choice.value !== "not_started";
              return (
                <button
                  key={choice.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={locked}
                  title={locked ? "Blocked: finish what it waits on first" : undefined}
                  onClick={() => !active && onSetStatus(item, choice.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    active ? "bg-primary-soft text-primary" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>

          {blocked ? (
            <div className="p-3 rounded-xl border border-warning/40 bg-warning-soft" data-testid="dialog-blockers">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                <IconLock className="w-3.5 h-3.5" />
                Blocked. It can start once {blockers.length === 1 ? "this is" : "these are"} completed:
              </p>
              <ul className="mt-2 space-y-1.5">
                {blockers.map((blocker) => (
                  <ItemLink key={blocker.id} item={blocker} status={summary.statuses.get(blocker.id)} onOpen={onOpenItem} />
                ))}
              </ul>
              {roots.length ? (
                <p className="mt-2.5 text-xs text-fg-muted">
                  Some of those are waiting too. The place to start is{" "}
                  {roots.slice(0, 3).map((root, index) => (
                    <React.Fragment key={root.id}>
                      {index > 0 ? ", " : ""}
                      <button type="button" onClick={() => onOpenItem(root)} className="font-semibold text-fg hover:underline underline-offset-2">
                        {root.title}
                      </button>
                    </React.Fragment>
                  ))}
                  {roots.length > 3 ? ` and ${roots.length - 3} more` : ""}.
                </p>
              ) : null}
            </div>
          ) : status === "ready" ? (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <IconUnlock className="w-3.5 h-3.5" />
              Ready. Everything it waits on is completed.
            </p>
          ) : null}
        </div>

        {/* What it is */}
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <Field label="Title">
            <input
              className={inputClass}
              value={title}
              maxLength={LIMITS.title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => commit("title", title, item.title)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </Field>
          <Field label="Area">
            <select className={inputClass} value={item.area} onChange={(e) => onUpdate(item.id, { area: e.target.value })}>
              {areaOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="What done looks like">
          <textarea
            className={`${inputClass} min-h-[4rem] resize-y`}
            value={description}
            maxLength={LIMITS.description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => commit("description", description, item.description)}
            placeholder="Describe the outcome, so it is clear when this is completed."
          />
        </Field>
        <Field label="Notes and decisions">
          <textarea
            className={`${inputClass} min-h-[6rem] resize-y`}
            value={notes}
            maxLength={LIMITS.notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => commit("notes", notes, item.notes)}
            placeholder="What you decided, links, numbers. Saved when you leave the field."
            data-testid="item-notes"
          />
        </Field>
        {item.link?.href ? (
          <Link href={item.link.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2">
            <IconExternal className="w-3.5 h-3.5" />
            {item.link.label}
          </Link>
        ) : null}

        {/* Dependencies */}
        <div className="space-y-2" data-testid="dialog-prerequisites">
          <SectionLabel count={prerequisites.length}>Waits on</SectionLabel>
          {prerequisites.length ? (
            <ul className="space-y-1.5">
              {prerequisites.map((prerequisite) => (
                <ItemLink
                  key={prerequisite.id}
                  item={prerequisite}
                  status={summary.statuses.get(prerequisite.id)}
                  onOpen={onOpenItem}
                  onRemove={() => {
                    const edge = edgeTo(prerequisite);
                    if (edge) onRemoveDependency(edge);
                  }}
                  removeLabel={`Stop waiting on ${prerequisite.title}`}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Nothing. This can be worked on at any time.</p>
          )}
          {prerequisites.length < LIMITS.dependenciesPerItem ? (
            <Dropdown
              id="business-add-prerequisite"
              value={null}
              groups={candidateGroups}
              onChange={(id) => id && onAddDependency(item.id, id)}
              placeholder="Add a prerequisite…"
              menuLabel="This cannot start before"
              emptyText="No other work item can come before this one"
              showDot={false}
            />
          ) : null}
        </div>

        <div className="space-y-2" data-testid="dialog-unlocks">
          <SectionLabel count={unlocks.length}>Unlocks</SectionLabel>
          {unlocks.length ? (
            <ul className="space-y-1.5">
              {unlocks.map((dependent) => (
                <ItemLink key={dependent.id} item={dependent} status={summary.statuses.get(dependent.id)} onOpen={onOpenItem} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Nothing is waiting on this.</p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
