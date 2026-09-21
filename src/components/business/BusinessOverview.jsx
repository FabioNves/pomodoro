"use client";

// The Business overview: where the business stands, the six connected phases,
// what to do next, the health numbers, the continuous cycle and what happened
// lately. It stays this simple on purpose; the detail lives one click away,
// inside each phase. Pure presentation: BusinessApp passes the derived
// summary in and receives what the user asks for.

import React, { useState } from "react";
import { phaseMeta, phaseNumber } from "@/lib/business/phases";
import PhaseMap from "@/components/business/PhaseMap";
import MetricsPanel from "@/components/business/MetricsPanel";
import CyclePanel from "@/components/business/CyclePanel";
import {
  ActionButton,
  BlockTitle,
  Panel,
  ProgressBar,
  StatusGlyph,
  statusTextClass,
  IconLoop,
  IconUnlock,
  relativeTime,
} from "@/components/business/businessUi";

const COUNT_LABELS = [
  ["completed", "completed"],
  ["in_progress", "in progress"],
  ["ready", "ready"],
  ["blocked", "blocked"],
  ["not_started", "not started"],
];

function Headline({ summary, allDone, cycle, onStartLoop }) {
  const [explain, setExplain] = useState(false);
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Business progress</div>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold text-fg leading-tight" data-testid="overall-headline">
            Your business is <span className="tabular-nums">{summary.overall.percent}%</span> operational
          </h2>
        </div>
        <div className="shrink-0 text-right text-xs text-fg-subtle tabular-nums">
          <div>
            {summary.done} of {summary.total} work items
          </div>
          {cycle > 1 ? <div>pass {cycle} of the cycle</div> : null}
        </div>
      </div>

      <ProgressBar percent={summary.overall.percent} size="lg" label="Overall business progress" className="mt-3" />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {COUNT_LABELS.map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-fg-muted" data-count={key}>
            <StatusGlyph status={key} className={`w-3 h-3 ${statusTextClass(key)}`} />
            <span className="font-semibold text-fg tabular-nums">{summary.counts[key]}</span>
            {label}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setExplain((open) => !open)}
          aria-expanded={explain}
          className="ml-auto text-fg-subtle hover:text-fg underline underline-offset-2 decoration-dotted"
        >
          How is this calculated?
        </button>
      </div>
      {explain ? (
        <p className="mt-2 text-xs text-fg-muted max-w-3xl">
          A phase&apos;s progress is its completed work items divided by all of its work items, so work in progress counts once it is
          completed. The business is the average of the six phases, each counting the same. Blocked and ready are worked out from the
          prerequisites between work items, never set by hand.
        </p>
      ) : null}

      {allDone ? (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-success/40 bg-success-soft" data-testid="cycle-complete">
          <IconLoop className="w-4 h-4 text-success shrink-0" />
          <p className="flex-1 text-sm text-fg">
            <span className="font-semibold">Pass {cycle} is complete.</span> That is a checkpoint, not the end: choose what to improve and take it
            round the cycle again.
          </p>
          <ActionButton tone="primary" size="sm" onClick={onStartLoop}>
            Start the next loop
          </ActionButton>
        </div>
      ) : null}
    </Panel>
  );
}

function NextActions({ actions, onOpenItem, onSetStatus }) {
  return (
    <Panel className="overflow-hidden h-full" >
      {actions.length ? (
        <ul className="divide-y divide-edge" data-testid="next-actions">
          {actions.map(({ item, status, unlocks }) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5" data-item={item.id}>
              <StatusGlyph status={status} className={`w-3.5 h-3.5 shrink-0 ${statusTextClass(status)}`} />
              <button type="button" onClick={() => onOpenItem(item)} className="min-w-0 flex-1 text-left group">
                <span className="block text-sm font-medium text-fg truncate group-hover:underline underline-offset-2">{item.title}</span>
                <span className="block text-[11px] text-fg-subtle truncate">
                  {phaseNumber(item.phase)} {phaseMeta(item.phase)?.name} · {item.area}
                  {unlocks ? (
                    <span className="text-fg-muted">
                      {" "}
                      · unlocks {unlocks} more
                    </span>
                  ) : null}
                </span>
              </button>
              <ActionButton
                size="sm"
                tone={status === "in_progress" ? "primary" : "outline"}
                onClick={() => onSetStatus(item, status === "in_progress" ? "completed" : "in_progress")}
              >
                {status === "in_progress" ? "Mark done" : "Start"}
              </ActionButton>
            </li>
          ))}
        </ul>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center gap-1.5 px-4 py-8">
          <IconUnlock className="w-5 h-5 text-fg-subtle" />
          <p className="text-sm font-semibold text-fg">Nothing is waiting for you</p>
          <p className="text-xs text-fg-muted max-w-xs">Every work item is completed. Start an improvement loop to take the business round the cycle again.</p>
        </div>
      )}
    </Panel>
  );
}

function ActivityList({ activity, itemsById, onOpenItem }) {
  if (!activity.length) return null;
  return (
    <div>
      <BlockTitle>Recent activity</BlockTitle>
      <Panel className="overflow-hidden" >
        <ul className="divide-y divide-edge" data-testid="activity">
          {activity.slice(0, 8).map((row) => {
            const item = row.item ? itemsById.get(row.item) : null;
            return (
              <li key={row.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                {item ? (
                  <button type="button" onClick={() => onOpenItem(item)} className="min-w-0 flex-1 text-left text-fg truncate hover:underline underline-offset-2">
                    {row.title}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 text-fg truncate">{row.title}</span>
                )}
                {row.phase ? <span className="shrink-0 text-fg-subtle hidden sm:inline">{phaseMeta(row.phase)?.name}</span> : null}
                <span className="shrink-0 text-fg-subtle tabular-nums">{relativeTime(row.at)}</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

export default function BusinessOverview({
  business,
  summary,
  loops,
  metrics,
  activity,
  itemsById,
  onOpenPhase,
  onOpenItem,
  onSetStatus,
  onSaveMetric,
  onCreateMetric,
  onDeleteMetric,
  onStartLoop,
  onRemoveLoop,
}) {
  const [loopFormOpen, setLoopFormOpen] = useState(false);
  const allDone = summary.total > 0 && summary.open === 0;

  const openLoopForm = () => {
    setLoopFormOpen(true);
    document.getElementById("business-cycle")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-6" data-testid="business-overview">
      <Headline summary={summary} allDone={allDone} cycle={business.cycle} onStartLoop={openLoopForm} />

      <PhaseMap phases={summary.phases} cycle={business.cycle} onOpenPhase={onOpenPhase} onOpenItem={onOpenItem} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 flex flex-col">
          <BlockTitle hint="What can move right now, the work already under way first.">Next actions</BlockTitle>
          <div className="flex-1">
            <NextActions actions={summary.nextActions.slice(0, 5)} onOpenItem={onOpenItem} onSetStatus={onSetStatus} />
          </div>
        </div>
        <div className="lg:col-span-2">
          <BlockTitle hint="Tap a number to record a new value.">Business health</BlockTitle>
          <MetricsPanel
            mode="overview"
            metrics={metrics}
            currency={business.currency}
            openItems={summary.open}
            blockedItems={summary.counts.blocked}
            onOpenWork={() => {
              const phase = summary.phases.find((p) => p.status !== "completed") || summary.phases[0];
              if (phase) onOpenPhase(phase.key);
            }}
            onSave={onSaveMetric}
            onCreate={onCreateMetric}
            onDelete={onDeleteMetric}
          />
        </div>
      </div>

      <CyclePanel
        phases={summary.phases}
        loops={loops}
        cycle={business.cycle}
        allDone={allDone}
        formOpen={loopFormOpen}
        onFormOpen={setLoopFormOpen}
        onOpenPhase={onOpenPhase}
        onOpenItem={onOpenItem}
        onStartLoop={onStartLoop}
        onRemoveLoop={onRemoveLoop}
      />

      <ActivityList activity={activity} itemsById={itemsById} onOpenItem={onOpenItem} />
    </div>
  );
}
