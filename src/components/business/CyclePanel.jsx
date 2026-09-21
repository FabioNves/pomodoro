"use client";

// Continuous improvement. Reaching Improve does not finish a business: what
// is learned there becomes the next Define. The ribbon shows the loop the way
// it is lived (Measure → Improve → Define → Build → Launch → Operate, and
// round again) and the list under it holds the improvement loops: one pass
// round the cycle for a single change, a step in every phase, each waiting on
// the one before. Starting a loop adds real work items, so the phases it
// passes through open up again instead of sitting at 100 %.

import React, { useState } from "react";
import { CYCLE_ORDER, LIMITS, phaseNumber } from "@/lib/business/phases";
import {
  ActionButton,
  Panel,
  PopoverMenu,
  StatusPill,
  inputClass,
  statusTextClass,
  IconArrowRight,
  IconLoop,
  IconPlus,
  IconTrash,
} from "@/components/business/businessUi";

function LoopRibbon({ phases, onOpenPhase }) {
  const byKey = new Map(phases.map((p) => [p.key, p]));
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2" data-testid="cycle-ribbon">
      {CYCLE_ORDER.map((key, index) => {
        const phase = byKey.get(key);
        if (!phase) return null;
        return (
          <React.Fragment key={key}>
            {index > 0 ? <IconArrowRight className="w-3.5 h-3.5 text-fg-subtle shrink-0" /> : null}
            <button
              type="button"
              onClick={() => onOpenPhase(key)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-edge bg-surface-2 text-xs font-semibold text-fg hover:border-edge-strong transition-colors"
              title={`${phase.name}: ${phase.percent}%`}
            >
              {phase.name}
              <span className={`tabular-nums font-medium ${statusTextClass(phase.status)}`}>{phase.percent}%</span>
            </button>
          </React.Fragment>
        );
      })}
      <span className="inline-flex items-center gap-1 text-xs text-fg-subtle pl-1">
        <IconLoop className="w-3.5 h-3.5 text-primary" />
        and round again
      </span>
    </div>
  );
}

/** Six dots, one per phase the loop passes through. */
function LoopTrack({ loop }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${loop.done} of ${loop.total} steps done`}>
      {loop.steps.map((step) => (
        <span
          key={step.item.id}
          title={`${phaseNumber(step.item.phase)} · ${step.item.title}`}
          className={`w-2.5 h-2.5 rounded-full border ${
            step.status === "completed"
              ? "bg-success border-success"
              : step === loop.current
                ? "bg-primary border-primary"
                : "bg-transparent border-edge-strong"
          }`}
        />
      ))}
    </div>
  );
}

function LoopRow({ loop, onOpenItem, onRemove }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5" data-loop={loop.id}>
      <span className="font-mono text-xs text-fg-subtle shrink-0">#{loop.number}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-fg truncate">{loop.title}</div>
        {loop.finished ? (
          <div className="text-xs text-success">Been round the whole cycle</div>
        ) : loop.current ? (
          <button
            type="button"
            onClick={() => onOpenItem(loop.current.item)}
            className="max-w-full text-left text-xs text-fg-muted hover:text-fg hover:underline underline-offset-2 truncate"
          >
            Now: {loop.current.item.title}
          </button>
        ) : (
          <div className="text-xs text-fg-subtle">Its steps were removed</div>
        )}
      </div>
      <div className="hidden sm:block shrink-0">
        <LoopTrack loop={loop} />
      </div>
      {loop.current ? (
        <span className="hidden sm:inline-flex shrink-0">
          <StatusPill status={loop.current.status} />
        </span>
      ) : null}
      <PopoverMenu
        label={`Options for ${loop.title}`}
        items={[{ label: "Remove loop and its steps", Icon: IconTrash, danger: true, onClick: () => onRemove(loop) }]}
      />
    </li>
  );
}

export default function CyclePanel({ phases, loops, cycle = 1, allDone = false, formOpen: formOpenProp, onFormOpen: onFormOpenProp, onOpenPhase, onOpenItem, onStartLoop, onRemoveLoop }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  // The overview opens the form from its "next loop" prompt; elsewhere the
  // panel looks after it itself.
  const [formOpenOwn, setFormOpenOwn] = useState(false);
  const formOpen = formOpenProp ?? formOpenOwn;
  const onFormOpen = onFormOpenProp ?? setFormOpenOwn;
  const active = loops.filter((loop) => !loop.finished);
  const finished = loops.filter((loop) => loop.finished);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const ok = await onStartLoop(title.trim());
    setBusy(false);
    if (ok) {
      setTitle("");
      onFormOpen(false);
    }
  };

  return (
    <Panel className="overflow-hidden" >
      <div className="px-4 pt-4 pb-3" id="business-cycle">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <IconLoop className="w-4 h-4 text-primary" />
              Continuous improvement
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted max-w-2xl">
              {allDone
                ? "Every phase is complete, and that is a checkpoint rather than the end. Pick the next thing to improve and take it round the cycle."
                : "A business is never finished. What you learn in Improve becomes the next Define."}
            </p>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded-full border border-edge bg-surface-2 text-[11px] font-semibold text-fg-muted tabular-nums" title="The setup is pass 1; every improvement loop is another pass">
            Pass {cycle}
          </span>
        </div>
        <div className="mt-3">
          <LoopRibbon phases={phases} onOpenPhase={onOpenPhase} />
        </div>
      </div>

      {active.length ? (
        <ul className="border-t border-edge divide-y divide-edge" data-testid="loop-list">
          {active.map((loop) => (
            <LoopRow key={loop.id} loop={loop} onOpenItem={onOpenItem} onRemove={onRemoveLoop} />
          ))}
        </ul>
      ) : null}

      <div className="border-t border-edge px-4 py-3">
        {formOpen ? (
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
            <input
              className={`${inputClass} flex-1`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={LIMITS.loopTitle}
              placeholder="What do you want to improve? e.g. New pricing strategy"
              autoFocus
              data-testid="loop-title"
            />
            <div className="flex items-center gap-2 justify-end">
              <ActionButton tone="ghost" onClick={() => onFormOpen(false)} disabled={busy}>
                Cancel
              </ActionButton>
              <ActionButton type="submit" tone="primary" busy={busy} disabled={!title.trim()}>
                Start loop
              </ActionButton>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-fg-subtle">
              {finished.length
                ? `${finished.length} loop${finished.length === 1 ? " has" : "s have"} been round the whole cycle.`
                : "A loop adds one step to every phase, from Define through to Improve."}
            </p>
            <ActionButton tone={allDone ? "primary" : "outline"} size="sm" Icon={IconPlus} onClick={() => onFormOpen(true)}>
              Start an improvement loop
            </ActionButton>
          </div>
        )}
      </div>
    </Panel>
  );
}
