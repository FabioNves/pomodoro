"use client";

// The six phases as connected cards: Define → Build → Launch on one row,
// Operate → Measure → Improve on the next, a connector carrying the flow from
// the first row into the second, and a rail under it that takes Improve back
// to Define. On a phone the same cards stack in one column with an arrow
// between each. One set of cards serves both: only the connectors change
// shape, so nothing is rendered twice.
//
// A card is not a wizard step: every one of them opens at any time. What a
// card is waiting on is named underneath it, and each name leads to that
// prerequisite.

import React from "react";
import { phaseNumber, phaseMeta } from "@/lib/business/phases";
import {
  ProgressBar,
  StatusPill,
  StatusGlyph,
  IconArrowRight,
  IconArrowDown,
  IconArrowUp,
  IconLock,
  IconLoop,
} from "@/components/business/businessUi";

// The two connector columns of the desktop grid are 2rem each, so the centre
// of the first and last card sits this far in from either edge.
const CARD_CENTRE = "calc((100% - 4rem) / 6)";

const CARD_BORDER = {
  blocked: "border-warning/50",
  completed: "border-success/50",
};

function PhaseCard({ phase, onOpenPhase, onOpenItem }) {
  const waiting = phase.waitingOn.slice(0, 2);
  const more = phase.waitingOn.length - waiting.length;
  const showWaiting = phase.status === "blocked" && waiting.length > 0;

  return (
    <div
      data-phase={phase.key}
      data-phase-status={phase.status}
      className={`h-full flex flex-col bg-surface border rounded-2xl shadow-sm transition-colors hover:border-edge-strong ${
        CARD_BORDER[phase.status] || "border-edge"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpenPhase(phase.key)}
        aria-label={`Open ${phase.name}: ${phase.percent}% complete`}
        className="flex-1 flex flex-col items-stretch justify-start text-left p-4 rounded-t-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-fg-subtle">{phaseNumber(phase.key)}</span>
          <StatusPill status={phase.status} />
        </div>
        <h3 className="mt-1 text-base font-semibold text-fg">{phase.name}</h3>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-fg tabular-nums leading-none" data-testid={`phase-percent-${phase.key}`}>
            {phase.percent}%
          </span>
          <span className="text-xs text-fg-subtle tabular-nums">
            {phase.total ? `${phase.done} of ${phase.total} done` : "no work items"}
          </span>
        </div>
        <ProgressBar percent={phase.percent} status={phase.status} label={`${phase.name} progress`} className="mt-2.5" />
        <p className="mt-3 text-xs text-fg-muted leading-relaxed">{phase.description}</p>
      </button>

      <div className="border-t border-edge px-4 py-2.5 text-xs min-h-[2.75rem] flex items-center">
        {showWaiting ? (
          <div className="min-w-0 w-full">
            <div className="flex items-center gap-1.5 text-warning font-semibold">
              <IconLock className="w-3 h-3 shrink-0" />
              Waiting on
            </div>
            <ul className="mt-1 space-y-0.5">
              {waiting.map(({ item }) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpenItem(item)}
                    className="max-w-full inline-flex items-baseline gap-1 text-left text-fg-muted hover:text-fg hover:underline underline-offset-2"
                    title={`Open "${item.title}" in ${phaseMeta(item.phase)?.name}`}
                  >
                    <span className="shrink-0 text-fg-subtle">{phaseMeta(item.phase)?.name} ·</span>
                    <span className="truncate">{item.title}</span>
                  </button>
                </li>
              ))}
              {more > 0 ? (
                <li>
                  <button type="button" onClick={() => onOpenPhase(phase.key)} className="text-fg-subtle hover:text-fg hover:underline underline-offset-2">
                    +{more} more
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        ) : phase.status === "completed" ? (
          <span className="inline-flex items-center gap-1.5 text-success font-medium">
            <StatusGlyph status="completed" className="w-3 h-3" />
            All work done
          </span>
        ) : phase.next ? (
          <div className="min-w-0 w-full flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenItem(phase.next)}
              className="min-w-0 flex-1 inline-flex items-baseline gap-1 text-left text-fg-muted hover:text-fg hover:underline underline-offset-2"
            >
              <span className="shrink-0 text-fg-subtle">Next ·</span>
              <span className="truncate">{phase.next.title}</span>
            </button>
            {phase.counts.blocked ? (
              <span className="shrink-0 inline-flex items-center gap-1 text-warning" title={`${phase.counts.blocked} blocked`}>
                <IconLock className="w-3 h-3" />
                {phase.counts.blocked}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-fg-subtle">No work items yet</span>
        )}
      </div>
    </div>
  );
}

/** Between two cards of a row: an arrow across on a wide screen, down on a phone. */
function Connector() {
  return (
    <div className="flex items-center justify-center text-fg-subtle h-7 md:h-auto md:w-8" aria-hidden="true">
      <IconArrowDown className="w-4 h-4 md:hidden" />
      <IconArrowRight className="w-4 h-4 hidden md:block" />
    </div>
  );
}

/** From the end of the first row to the start of the second. */
function RowConnector() {
  return (
    <div className="md:col-span-5" aria-hidden="true">
      <div className="flex items-center justify-center text-fg-subtle h-7 md:hidden">
        <IconArrowDown className="w-4 h-4" />
      </div>
      <div className="hidden md:block relative h-8 text-edge-strong" style={{ marginLeft: CARD_CENTRE, marginRight: CARD_CENTRE }}>
        <div className="absolute top-0 right-0 w-1/2 h-1/2 border-r border-b border-edge-strong rounded-br-xl" />
        <div className="absolute left-0 bottom-1 w-1/2 border-l border-t border-edge-strong rounded-tl-xl" style={{ top: "calc(50% - 1px)" }} />
        <IconArrowDown className="absolute -bottom-1 left-0 -translate-x-1/2 w-3.5 h-3.5 text-fg-subtle" />
      </div>
    </div>
  );
}

/** Under the second row: Improve hands back to Define, and round it goes again. */
function CycleRail({ cycle }) {
  const label = (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-edge text-[11px] font-semibold uppercase tracking-wide text-fg-muted whitespace-nowrap">
      <IconLoop className="w-3.5 h-3.5 text-primary" />
      Continuous cycle
      <span className="hidden sm:inline font-medium normal-case tracking-normal text-fg-subtle">· Improve feeds the next Define</span>
      {cycle > 1 ? <span className="font-medium normal-case tracking-normal text-fg-subtle">· pass {cycle}</span> : null}
    </span>
  );
  return (
    <div className="md:col-span-5" data-testid="cycle-rail">
      <div className="md:hidden flex flex-col items-center gap-1 pt-1 text-fg-subtle">
        <IconArrowDown className="w-4 h-4" aria-hidden="true" />
        {label}
        <span className="text-[11px]">back to 01 Define</span>
      </div>
      <div className="hidden md:block relative h-10" style={{ marginLeft: CARD_CENTRE, marginRight: CARD_CENTRE }}>
        <div className="absolute inset-x-0 top-1 h-5 border-l border-r border-b border-edge-strong rounded-b-xl" aria-hidden="true" />
        <IconArrowUp className="absolute -top-0.5 left-0 -translate-x-1/2 w-3.5 h-3.5 text-fg-subtle" />
        <div className="absolute inset-x-0 top-6 -translate-y-1/2 flex justify-center">{label}</div>
      </div>
    </div>
  );
}

export default function PhaseMap({ phases, cycle = 1, onOpenPhase, onOpenItem }) {
  const cells = [];
  phases.forEach((phase, index) => {
    cells.push(<PhaseCard key={phase.key} phase={phase} onOpenPhase={onOpenPhase} onOpenItem={onOpenItem} />);
    if (index === phases.length - 1) return;
    cells.push(index === 2 ? <RowConnector key={`row-${phase.key}`} /> : <Connector key={`to-${phase.key}`} />);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)_2rem_minmax(0,1fr)]" data-testid="phase-map">
      {cells}
      <CycleRail cycle={cycle} />
    </div>
  );
}
