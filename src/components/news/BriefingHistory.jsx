"use client";

// Past briefings: today's, previous daily ones, weekly ones, scheduled ones.

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { newsApi } from "@/lib/news/client";
import { ActionButton, Chip, EmptyState, IconHistory, KIND_LABELS, Spinner, formatDate, statusTone } from "@/components/news/newsUi";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "custom", label: "Custom" },
];

const STATUS_LABEL = { ready: "Ready", generating: "Generating", empty: "Nothing found", failed: "Failed" };

export default function BriefingHistory({ onOpen, activeId, refreshKey = 0 }) {
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  // Switching filters quickly can land replies out of order; only the newest
  // request is allowed to write to the list.
  const loadIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ append = false } = {}) => {
      const myLoad = (loadIdRef.current += 1);
      setLoading(true);
      try {
        const before = append && items.length ? `&before=${encodeURIComponent(items[items.length - 1].createdAt)}` : "";
        const data = await newsApi(`/api/news/briefings?kind=${filter}&limit=20${before}`);
        if (!mountedRef.current || loadIdRef.current !== myLoad) return;
        setItems((prev) => (append ? [...prev, ...data.briefings] : data.briefings));
        setHasMore(Boolean(data.hasMore));
      } catch (e) {
        if (!mountedRef.current || loadIdRef.current !== myLoad) return;
        toast.error(e.message || "Could not load briefing history.");
      } finally {
        if (mountedRef.current && loadIdRef.current === myLoad) setLoading(false);
      }
    },
    [filter, items],
  );

  useEffect(() => {
    load();
  }, [filter, refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Chip key={f.key} onClick={() => setFilter(f.key)} tone={filter === f.key ? "primary" : "neutral"}>
            {f.label}
          </Chip>
        ))}
      </div>

      {loading && !items.length ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner /> Loading…
        </p>
      ) : !items.length ? (
        <EmptyState Icon={IconHistory} title="No briefings yet" hint="Generated briefings, manual and scheduled, will be listed here." />
      ) : (
        <ul className="space-y-2">
          {items.map((b) => {
            const active = b.id === activeId;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onOpen(b)}
                  className={`w-full text-left bg-surface border rounded-2xl px-4 py-3 shadow-sm transition-colors ${
                    active ? "border-primary bg-primary-soft/40" : "border-edge hover:border-edge-strong"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-fg truncate">
                        {KIND_LABELS[b.kind] || b.kind} · {b.periodKey}
                      </p>
                      <p className="text-[11px] text-fg-subtle">
                        {formatDate(b.createdAt, { withTime: true })} · {b.trigger === "scheduled" ? "scheduled" : "generated manually"}
                        {b.status === "ready" ? ` · ${b.storyCount} stor${b.storyCount === 1 ? "y" : "ies"}` : ""}
                      </p>
                    </div>
                    <Chip tone={statusTone(b.status)}>{STATUS_LABEL[b.status] || b.status}</Chip>
                  </div>
                  {b.status === "failed" && b.error ? <p className="mt-1 text-[11px] text-danger truncate">{b.error}</p> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore ? (
        <ActionButton onClick={() => load({ append: true })} busy={loading}>
          Load more
        </ActionButton>
      ) : null}
    </div>
  );
}
