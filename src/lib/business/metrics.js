// Business health: the numbers a business keeps an eye on. Shared with the
// browser. A BusinessMetric is typed in by hand today (`source: "manual"`);
// a future Finance or CRM module can write the same documents under its own
// `source`, and the screens will not know the difference.

export const METRIC_KINDS = [
  { key: "currency", label: "Money" },
  { key: "number", label: "Number" },
  { key: "percent", label: "Percentage" },
];

export const METRIC_KIND_KEYS = METRIC_KINDS.map((k) => k.key);

/** The metrics every business starts with. `pinned` ones show on the overview. */
export const DEFAULT_METRICS = [
  { key: "revenue", label: "Revenue", kind: "currency", hint: "per month", pinned: true },
  { key: "customers", label: "Customers", kind: "number", hint: "active", pinned: true },
  { key: "costs", label: "Costs", kind: "currency", hint: "per month", pinned: false },
  { key: "conversion", label: "Conversion", kind: "percent", hint: "leads that pay", pinned: false },
  { key: "retention", label: "Retention", kind: "percent", hint: "customers who stay", pinned: false },
];

/** "€12,400", "48", "3.5%", or "–" while nothing has been recorded. */
export function formatMetric(value, kind, currency = "EUR") {
  if (value === null || value === undefined || value === "") return "–";
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  if (kind === "currency") {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
      }).format(n);
    } catch {
      return `${currency} ${n.toLocaleString()}`;
    }
  }
  if (kind === "percent") return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Change against the value recorded before the current one, or null when
 * there is nothing to compare with.
 * @returns {{ diff: number, percent: number|null, direction: "up"|"down"|"flat" } | null}
 */
export function metricDelta(metric) {
  const history = metric?.history || [];
  if (history.length < 2 || metric.value === null || metric.value === undefined) return null;
  const previous = Number(history[history.length - 2]?.value);
  const current = Number(metric.value);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return null;
  const diff = current - previous;
  return {
    diff,
    percent: previous ? (diff / Math.abs(previous)) * 100 : null,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

/** How far a metric is towards its target, 0–100, or null without a target. */
export function targetProgress(metric) {
  const target = Number(metric?.target);
  const value = Number(metric?.value);
  if (!Number.isFinite(target) || target <= 0 || metric?.value === null || metric?.value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}
