"use client";

// The workspace of one phase: its progress, what it is waiting on, and its
// work grouped into areas (Business identity, Pricing, Payments…). Each area
// is a card of its own, so an area can grow into something richer later
// without the phase being a giant form. The strip at the top reaches every
// phase at any time: nothing here has a "Next" button to wait for.

import React, { useEffect, useRef, useState } from "react";
import { LIMITS, areasOf, nextPhaseKey, phaseMeta, phaseNumber } from "@/lib/business/phases";
import { blockersOf } from "@/lib/business/engine";
import {
  ActionButton,
  BlockTitle,
  Panel,
  ProgressBar,
  StatusGlyph,
  StatusPill,
  inputClass,
  statusTextClass,
  IconArrowRight,
  IconBack,
  IconLock,
  IconLoop,
  IconPlus,
} from "@/components/business/businessUi";

/* ── phase strip ───────────────────────────────────────── */

function PhaseStrip({ phases, current, onOpenPhase }) {
  return (
    <nav aria-label="Phases" className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
      {phases.map((phase, index) => {
        const active = phase.key === current;
        return (
          <React.Fragment key={phase.key}>
            {index > 0 ? <IconArrowRight className="w-3 h-3 text-fg-subtle shrink-0" /> : null}
            <button
              type="button"
              onClick={() => onOpenPhase(phase.key)}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                active
                  ? "bg-primary-soft border-primary/30 text-fg"
                  : "bg-surface border-edge text-fg-muted hover:text-fg hover:border-edge-strong"
              }`}
            >
              <span className="font-mono text-[10px] text-fg-subtle">{phaseNumber(phase.key)}</span>
              {phase.name}
              <span className={`tabular-nums font-medium ${statusTextClass(phase.status)}`}>{phase.percent}%</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ── work item row ─────────────────────────────────────── */

const GLYPH_BUTTON = {
  completed: "border bg-success border-success text-surface",
  in_progress: "text-primary hover:text-success",
  ready: "border border-success text-transparent hover:text-success",
  not_started: "border border-edge-strong text-transparent hover:text-fg-subtle",
};

/** Half-filled ring, the size of the round toggle it stands in for. */
function HalfRing() {
  return (
    <svg viewBox="0 0 20 20" className="w-5 h-5" aria-hidden="true">
      <circle cx="10" cy="10" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 3a7 7 0 010 14z" fill="currentColor" />
    </svg>
  );
}

function WorkItemRow({ item, status, blockers, highlighted, onOpen, onOpenItem, onSetStatus }) {
  const ref = useRef(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlighted]);

  const blocked = status === "blocked";
  const completed = status === "completed";

  return (
    <li
      ref={ref}
      data-item={item.id}
      data-item-status={status}
      className={`px-3 py-2.5 transition-colors ${highlighted ? "bg-primary-soft/60" : "hover:bg-surface-hover/60"}`}
    >
      <div className="flex items-start gap-2.5">
        {blocked ? (
          <button
            type="button"
            onClick={() => onOpen(item)}
            aria-label={`${item.title} is blocked. Show what it waits on`}
            title="Blocked. Show what it waits on"
            className="mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center text-warning"
          >
            <IconLock className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSetStatus(item, completed ? "not_started" : "completed")}
            aria-pressed={completed}
            aria-label={completed ? `Reopen ${item.title}` : `Mark ${item.title} as completed`}
            title={completed ? "Reopen" : "Mark as completed"}
            className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center transition-colors ${GLYPH_BUTTON[status]}`}
          >
            {status === "in_progress" ? <HalfRing /> : <StatusGlyph status="completed" className="w-3 h-3" />}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpen(item)}
            data-testid="item-title"
            className={`block max-w-full text-left text-sm font-medium hover:underline underline-offset-2 ${
              completed ? "text-fg-subtle line-through" : "text-fg"
            }`}
          >
            {item.title}
          </button>
          {blocked ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs" data-testid="blocked-by">
              <span className="text-warning font-semibold">Blocked by</span>
              {blockers.map((blocker) => (
                <button
                  key={blocker.id}
                  type="button"
                  onClick={() => onOpenItem(blocker)}
                  title={`Go to "${blocker.title}" in ${phaseMeta(blocker.phase)?.name}`}
                  className="inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md border border-warning/30 bg-warning-soft text-fg hover:border-warning transition-colors"
                >
                  <span className="truncate">{blocker.title}</span>
                  {blocker.phase !== item.phase ? <span className="shrink-0 text-fg-subtle">· {phaseMeta(blocker.phase)?.name}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {status === "ready" || status === "not_started" ? (
            <button
              type="button"
              onClick={() => onSetStatus(item, "in_progress")}
              className="px-2 py-0.5 rounded-md border border-edge text-[11px] font-semibold text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
            >
              Start
            </button>
          ) : null}
          <span className="hidden sm:inline-flex">
            <StatusPill status={status} />
          </span>
        </div>
      </div>
      {/* On a phone the pill sits under the title, where it has room. */}
      <div className="sm:hidden mt-1.5 pl-[1.875rem]">
        <StatusPill status={status} />
      </div>
    </li>
  );
}

/* ── area card ─────────────────────────────────────────── */

function AddItemForm({ placeholder, onAdd, onCancel }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const ok = await onAdd(title.trim());
    setBusy(false);
    if (ok) setTitle("");
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-3 py-2.5">
      <input
        className={`${inputClass} flex-1 !py-1.5`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={LIMITS.title}
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        aria-label="Work item title"
      />
      <ActionButton type="submit" tone="primary" size="sm" busy={busy} disabled={!title.trim()}>
        Add
      </ActionButton>
      <ActionButton tone="ghost" size="sm" onClick={onCancel} disabled={busy}>
        Done
      </ActionButton>
    </form>
  );
}

function AreaCard({ area, items, summary, highlightedId, onOpen, onOpenItem, onSetStatus, onAddItem }) {
  const [adding, setAdding] = useState(false);
  const done = items.filter((item) => summary.statuses.get(item.id) === "completed").length;
  return (
    <Panel className="overflow-hidden" >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-edge" data-area={area}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted truncate">{area}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] tabular-nums ${items.length && done === items.length ? "text-success font-semibold" : "text-fg-subtle"}`}>
            {done}/{items.length}
          </span>
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={`Add a work item to ${area}`}
            title="Add a work item"
            className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors"
          >
            <IconPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>
      {items.length ? (
        <ul className="divide-y divide-edge">
          {items.map((item) => (
            <WorkItemRow
              key={item.id}
              item={item}
              status={summary.statuses.get(item.id)}
              blockers={blockersOf(item.id, summary.graph)}
              highlighted={item.id === highlightedId}
              onOpen={onOpen}
              onOpenItem={onOpenItem}
              onSetStatus={onSetStatus}
            />
          ))}
        </ul>
      ) : adding ? null : (
        <p className="px-3 py-3 text-xs text-fg-subtle">Nothing here yet.</p>
      )}
      {adding ? (
        <div className={items.length ? "border-t border-edge" : ""}>
          <AddItemForm placeholder={`New work item in ${area}`} onAdd={(title) => onAddItem(area, title)} onCancel={() => setAdding(false)} />
        </div>
      ) : null}
    </Panel>
  );
}

function NewAreaForm({ onAdd, onCancel }) {
  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!area.trim() || !title.trim() || busy) return;
    setBusy(true);
    const ok = await onAdd(area.trim(), title.trim());
    setBusy(false);
    if (ok) onCancel();
  };
  return (
    <Panel className="p-3">
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto] sm:items-center">
        <input className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} maxLength={LIMITS.area} placeholder="Area, e.g. Partnerships" autoFocus aria-label="Area name" />
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} placeholder="Its first work item" aria-label="First work item" />
        <div className="flex items-center justify-end gap-2">
          <ActionButton tone="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" tone="primary" size="sm" busy={busy} disabled={!area.trim() || !title.trim()}>
            Add area
          </ActionButton>
        </div>
      </form>
    </Panel>
  );
}

/* ── workspace ─────────────────────────────────────────── */

export default function PhaseWorkspace({
  phase,
  summary,
  items,
  highlightedId,
  onBack,
  onOpenPhase,
  onOpenItem,
  onSetStatus,
  onAddItem,
  children = null,
}) {
  const [addingArea, setAddingArea] = useState(false);
  const own = items.filter((item) => item.phase === phase.key).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const areas = areasOf(phase.key, items, { withEmpty: true });
  const next = summary.phases.find((p) => p.key === nextPhaseKey(phase.key));
  const wraps = next && next.order < phase.order;
  const external = phase.waitingOn.filter(({ item }) => item.phase !== phase.key);

  return (
    <div className="space-y-5" data-testid={`workspace-${phase.key}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-edge bg-surface text-xs font-semibold text-fg-muted hover:text-fg hover:border-edge-strong transition-colors"
        >
          <IconBack className="w-3.5 h-3.5" />
          Overview
        </button>
        <div className="min-w-0 flex-1">
          <PhaseStrip phases={summary.phases} current={phase.key} onOpenPhase={onOpenPhase} />
        </div>
      </div>

      <Panel className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-fg-subtle">{phaseNumber(phase.key)}</span>
          <StatusPill status={phase.status} />
        </div>
        <h2 className="mt-0.5 text-xl font-bold text-fg leading-tight">{phase.name}</h2>
        <p className="mt-1 text-sm text-fg-muted max-w-2xl">{phase.description}</p>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-fg tabular-nums leading-none" data-testid="workspace-percent">
            {phase.percent}%
          </span>
          <span className="text-xs text-fg-subtle">
            {phase.done} of {phase.total} done
            {phase.counts.in_progress ? ` · ${phase.counts.in_progress} in progress` : ""}
            {phase.counts.ready + phase.counts.not_started ? ` · ${phase.counts.ready + phase.counts.not_started} can start` : ""}
            {phase.counts.blocked ? ` · ${phase.counts.blocked} blocked` : ""}
          </span>
        </div>
        <ProgressBar percent={phase.percent} status={phase.status} size="lg" label={`${phase.name} progress`} className="mt-2.5" />

        {external.length ? (
          <div className="mt-4 pt-3 border-t border-edge" data-testid="waiting-on">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
              <IconLock className="w-3.5 h-3.5" />
              Waiting on work in other phases
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {external.map(({ item, blocks }) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenItem(item)}
                  className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-lg border border-edge bg-surface-2 text-xs text-fg hover:border-edge-strong transition-colors"
                  title={`Blocks ${blocks} work item${blocks === 1 ? "" : "s"} here`}
                >
                  <span className="shrink-0 font-mono text-[10px] text-fg-subtle">{phaseNumber(item.phase)}</span>
                  <span className="truncate">{item.title}</span>
                  <StatusGlyph status={summary.statuses.get(item.id)} className={`w-3 h-3 shrink-0 ${statusTextClass(summary.statuses.get(item.id))}`} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>

      {children}

      <div>
        <BlockTitle
          action={
            <ActionButton size="sm" Icon={IconPlus} onClick={() => setAddingArea(true)}>
              Add an area
            </ActionButton>
          }
        >
          Work in {phase.name}
        </BlockTitle>
        <div className="grid gap-3 md:grid-cols-2 items-start">
          {areas.map((area) => (
            <AreaCard
              key={area}
              area={area}
              items={own.filter((item) => item.area === area)}
              summary={summary}
              highlightedId={highlightedId}
              onOpen={onOpenItem}
              onOpenItem={onOpenItem}
              onSetStatus={onSetStatus}
              onAddItem={(areaName, title) => onAddItem({ phase: phase.key, area: areaName, title })}
            />
          ))}
        </div>
        {addingArea ? (
          <div className="mt-3">
            <NewAreaForm onAdd={(areaName, title) => onAddItem({ phase: phase.key, area: areaName, title })} onCancel={() => setAddingArea(false)} />
          </div>
        ) : null}
      </div>

      {next ? (
        <button
          type="button"
          onClick={() => onOpenPhase(next.key)}
          data-testid="next-phase"
          className="w-full flex items-center gap-3 p-4 text-left bg-surface border border-edge rounded-2xl shadow-sm hover:border-edge-strong transition-colors"
        >
          <span className="w-9 h-9 shrink-0 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
            {wraps ? <IconLoop className="w-4 h-4" /> : <IconArrowRight className="w-4 h-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
              {wraps ? "The cycle continues" : "What comes after this"}
            </span>
            <span className="block text-sm font-semibold text-fg">
              {phaseNumber(next.key)} {next.name}
              <span className="font-normal text-fg-muted"> · {wraps ? "What you learn here becomes the next Define." : next.description}</span>
            </span>
          </span>
          <span className="hidden sm:inline-flex shrink-0">
            <StatusPill status={next.status} />
          </span>
        </button>
      ) : null}
    </div>
  );
}
