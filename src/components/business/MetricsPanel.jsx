"use client";

// Business health: the numbers the business keeps an eye on, as tiles. The
// overview shows the pinned ones next to "Open work items", which is counted
// from the work items rather than stored; the Measure workspace shows them
// all and adds new ones. A tile opens a small dialog to record a new value,
// which the server also appends to the metric's history.

import React, { useEffect, useState } from "react";
import ModalShell from "@/components/planner/ModalShell";
import { METRIC_KINDS, formatMetric, metricDelta, targetProgress } from "@/lib/business/metrics";
import { LIMITS } from "@/lib/business/phases";
import {
  ActionButton,
  Field,
  inputClass,
  Toggle,
  ProgressBar,
  IconPlus,
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  relativeTime,
} from "@/components/business/businessUi";

const toNumberOrNull = (text) => {
  const trimmed = String(text ?? "").trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
};

function Delta({ metric }) {
  const delta = metricDelta(metric);
  if (!delta || delta.direction === "flat") return null;
  const up = delta.direction === "up";
  const Arrow = up ? IconArrowUp : IconArrowDown;
  // Costs going down is the good direction; everything else is better up.
  const good = metric.key === "costs" ? !up : up;
  const amount =
    delta.percent === null
      ? formatMetric(Math.abs(delta.diff), metric.kind === "currency" ? "number" : metric.kind)
      : `${Math.abs(delta.percent).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${good ? "text-success" : "text-danger"}`}>
      <Arrow className="w-3 h-3" />
      {amount}
    </span>
  );
}

function MetricTile({ metric, currency, onClick }) {
  const progress = targetProgress(metric);
  const empty = metric.value === null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-metric={metric.key}
      className="text-left bg-surface border border-edge rounded-2xl px-4 py-3 shadow-sm hover:border-edge-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
    >
      <div className="text-[11px] uppercase tracking-wide text-fg-subtle truncate">{metric.label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-2xl font-bold leading-none tabular-nums ${empty ? "text-fg-subtle" : "text-fg"}`}>
          {formatMetric(metric.value, metric.kind, currency)}
        </span>
        <Delta metric={metric} />
      </div>
      <div className="mt-1 text-[11px] text-fg-muted truncate">
        {empty ? "Tap to record" : metric.hint || `updated ${relativeTime(metric.updatedAt)}`}
      </div>
      {progress !== null ? (
        <div className="mt-2">
          <ProgressBar percent={progress} label={`${metric.label} towards target`} />
          <div className="mt-1 text-[10px] text-fg-subtle tabular-nums">
            {progress}% of {formatMetric(metric.target, metric.kind, currency)}
          </div>
        </div>
      ) : null}
    </button>
  );
}

/** A figure that is counted, not typed in. */
function DerivedTile({ label, value, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-surface border border-edge rounded-2xl px-4 py-3 shadow-sm hover:border-edge-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
    >
      <div className="text-[11px] uppercase tracking-wide text-fg-subtle truncate">{label}</div>
      <div className="mt-1 text-2xl font-bold text-fg leading-none tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-fg-muted truncate">{hint}</div> : null}
    </button>
  );
}

function MetricDialog({ state, currency, onClose, onSave, onCreate, onDelete }) {
  const metric = state?.metric || null;
  const creating = Boolean(state) && !metric;
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("number");
  const [value, setValue] = useState("");
  const [target, setTarget] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setLabel(metric?.label || "");
    setKind(metric?.kind || "number");
    setValue(metric?.value === null || metric?.value === undefined ? "" : String(metric.value));
    setTarget(metric?.target === null || metric?.target === undefined ? "" : String(metric.target));
    setPinned(metric ? metric.pinned : true);
    setError("");
  }, [state, metric]);

  const submit = async (e) => {
    e.preventDefault();
    const v = toNumberOrNull(value);
    const t = toNumberOrNull(target);
    if (v === undefined || t === undefined) return setError("Use numbers only, for example 12400 or 3.5.");
    if (!label.trim()) return setError("Give the metric a name.");
    setBusy(true);
    const ok = creating
      ? await onCreate({ label: label.trim(), kind, value: v, target: t, pinned })
      : await onSave(metric.id, { label: label.trim(), value: v, target: t, pinned });
    setBusy(false);
    if (ok) onClose();
  };

  const unit = kind === "currency" ? currency : kind === "percent" ? "%" : "";

  return (
    <ModalShell
      open={Boolean(state)}
      onClose={onClose}
      size="sm"
      title={creating ? "Add a metric" : `Update ${metric?.label || ""}`}
      subtitle={creating ? "A number you want to watch" : "Each new value is kept, so you can see the change"}
    >
      <form onSubmit={submit} className="px-5 py-4 space-y-4">
        {creating || metric?.source === "manual" ? (
          <Field label="Name">
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={LIMITS.metricLabel} placeholder="e.g. Average order value" autoFocus={creating} />
          </Field>
        ) : null}
        {creating ? (
          <Field label="Kind">
            <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)}>
              {METRIC_KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Value${unit ? ` (${unit})` : ""}`}>
            <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="–" autoFocus={!creating} data-testid="metric-value" />
          </Field>
          <Field label="Target (optional)">
            <input className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="–" />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">Show on the overview</p>
            <p className="text-xs text-fg-muted">Under Business health, next to the phases.</p>
          </div>
          <Toggle checked={pinned} onChange={setPinned} label="Show on the overview" />
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <div className="flex items-center justify-between gap-2 pt-1">
          {metric ? (
            <ActionButton
              tone="ghost"
              size="sm"
              Icon={IconTrash}
              onClick={async () => {
                if (await onDelete(metric)) onClose();
              }}
            >
              Delete
            </ActionButton>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <ActionButton tone="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" tone="primary" busy={busy}>
              {creating ? "Add metric" : "Save"}
            </ActionButton>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

/**
 * @param {"overview"|"all"} props.mode overview: pinned metrics plus the
 *   derived open-work tile; all: every metric and the button to add one.
 */
export default function MetricsPanel({ mode = "overview", metrics, currency, openItems = 0, blockedItems = 0, onOpenWork, onSave, onCreate, onDelete }) {
  const [dialog, setDialog] = useState(null); // { metric } to edit, {} to create
  const shown = mode === "overview" ? metrics.filter((m) => m.pinned) : metrics;

  return (
    <div data-testid={`metrics-${mode}`}>
      <div className={`grid gap-3 ${mode === "overview" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"}`}>
        {shown.map((metric) => (
          <MetricTile key={metric.id} metric={metric} currency={currency} onClick={() => setDialog({ metric })} />
        ))}
        {mode === "overview" ? (
          <DerivedTile
            label="Open work"
            value={openItems}
            hint={blockedItems ? `${blockedItems} blocked` : openItems ? "none blocked" : "all done"}
            onClick={onOpenWork}
          />
        ) : (
          <button
            type="button"
            onClick={() => setDialog({})}
            className="flex flex-col items-center justify-center gap-1 min-h-[5.5rem] rounded-2xl border border-dashed border-edge-strong text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors text-xs font-semibold"
          >
            <IconPlus className="w-4 h-4" />
            Add a metric
          </button>
        )}
      </div>
      <MetricDialog
        state={dialog}
        currency={currency}
        onClose={() => setDialog(null)}
        onSave={onSave}
        onCreate={onCreate}
        onDelete={onDelete}
      />
    </div>
  );
}
