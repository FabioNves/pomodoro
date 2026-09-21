"use client";

// The Business screen. It loads one snapshot from /api/business (phases, work
// items, dependencies, metrics, activity) and derives everything else with
// the shared engine: statuses, phase and overall progress, what is blocked
// and by what, the next actions. A change is applied to the snapshot at once
// and sent to the server, so the whole page follows a tick without a reload,
// and is rolled back if the server refuses it.
//
// The place is kept in the query string, so links, reloads and the back
// button work: ?b= the business (when there are several), ?phase= the open
// phase workspace, ?item= the open work item.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { useFeatureGate } from "@/lib/access/client";
import ModalShell from "@/components/planner/ModalShell";
import Dropdown from "@/components/ui/Dropdown";
import { businessApi } from "@/lib/business/client";
import { summarize, loopSummaries, dependentsOf } from "@/lib/business/engine";
import { LIMITS, PHASES, PHASE_KEYS, businessTypeMeta, phaseMeta } from "@/lib/business/phases";
import BusinessForm from "@/components/business/BusinessForm";
import BusinessOverview from "@/components/business/BusinessOverview";
import PhaseWorkspace from "@/components/business/PhaseWorkspace";
import WorkItemDialog from "@/components/business/WorkItemDialog";
import MetricsPanel from "@/components/business/MetricsPanel";
import CyclePanel from "@/components/business/CyclePanel";
import {
  ActionButton,
  BlockTitle,
  Panel,
  PopoverMenu,
  Spinner,
  IconAlert,
  IconArrowRight,
  IconBusiness,
  IconEdit,
  IconLock,
  IconLoop,
  IconPlus,
  IconTrash,
} from "@/components/business/businessUi";

const EMPTY = { businesses: [], business: null, phases: [], items: [], dependencies: [], metrics: [], activity: [] };

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function namesOf(list) {
  const titles = list.slice(0, 2).map((item) => `"${item.title}"`);
  return list.length > 2 ? `${titles.join(", ")} and ${list.length - 2} more` : titles.join(" and ");
}

/** The onboarding state of an account with no business yet. */
function CreateBusiness({ onCreate }) {
  return (
    <div className="max-w-2xl mx-auto" data-testid="business-empty">
      <Panel className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
            <IconBusiness className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-fg">Create your business</h2>
            <p className="mt-0.5 text-sm text-fg-muted">
              Name it and say what kind of business it is. You get the six phases, a first set of work items for each and the prerequisites
              between them. Everything can be changed afterwards.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs font-semibold text-fg-muted" aria-hidden="true">
          {PHASES.map((phase, index) => (
            <React.Fragment key={phase.key}>
              {index > 0 ? <IconArrowRight className="w-3 h-3 text-fg-subtle" /> : null}
              <span className="px-2 py-0.5 rounded-full border border-edge bg-surface-2">{phase.name}</span>
            </React.Fragment>
          ))}
          <IconLoop className="w-3.5 h-3.5 text-primary ml-0.5" />
        </div>
        <div className="mt-5 pt-5 border-t border-edge">
          <BusinessForm onSubmit={onCreate} />
        </div>
      </Panel>
    </div>
  );
}

export default function BusinessApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessParam = searchParams.get("b");
  const phaseParam = searchParams.get("phase");
  const itemParam = searchParams.get("item");

  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dialog, setDialog] = useState(null); // "create" | "edit"
  // In no plan yet: only the admin gets this screen (see isAdminOnly).
  const { adminOnly } = useFeatureGate("business");
  const loadedRef = useRef(undefined); // id of the business on screen; undefined before the first load
  const inFlightRef = useRef(undefined); // the business a load is fetching right now ("" for the default one)
  const pendingQueryRef = useRef(null); // the query string last asked for, until the router catches up
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // The router applies a change a moment later, so two changes in a row would
  // both start from the same old query string and the second would undo the
  // first. Each change therefore builds on the last one asked for, until the
  // URL has caught up (or the user has gone Back or Forward).
  useEffect(() => {
    pendingQueryRef.current = null;
  }, [searchParams]);

  const setParams = useCallback(
    (patch, { push = false } = {}) => {
      const params = new URLSearchParams(pendingQueryRef.current ?? searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, String(value));
      }
      pendingQueryRef.current = params.toString();
      const url = params.toString() ? `/business?${params.toString()}` : "/business";
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [router, searchParams],
  );

  /* ── loading ─────────────────────────────────────────── */

  const load = useCallback(async (businessId = null) => {
    setLoading(true);
    setLoadError(null);
    inFlightRef.current = businessId || "";
    try {
      const snapshot = await businessApi(`/api/business${businessId ? `?business=${encodeURIComponent(businessId)}` : ""}`);
      if (!mountedRef.current) return;
      loadedRef.current = snapshot.business?.id || null;
      setData(snapshot);
    } catch (e) {
      if (!mountedRef.current) return;
      setLoadError(e.message || "Could not load your business.");
    } finally {
      inFlightRef.current = undefined;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // First load, and again whenever the URL asks for a business other than the
  // one on screen (no ?b= means the first one). A ?b= that names no business
  // is left to the tidy-up below rather than fetched again.
  useEffect(() => {
    if (inFlightRef.current === (businessParam || "")) return;
    const shown = loadedRef.current;
    if (shown !== undefined) {
      const wanted = businessParam || data.businesses[0]?.id || null;
      if (wanted === shown) return;
      if (businessParam && !data.businesses.some((b) => b.id === businessParam)) return;
    }
    load(businessParam);
  }, [businessParam, data.businesses, load]);

  /* ── derived ─────────────────────────────────────────── */

  const { business, businesses, phases, items, dependencies, metrics, activity } = data;
  const summary = useMemo(() => summarize({ phases, items, dependencies }), [phases, items, dependencies]);
  const loops = useMemo(
    () => loopSummaries(business?.loops || [], items, summary.statuses, phases),
    [business, items, summary, phases],
  );
  const itemsById = summary.graph.byId;
  const openPhase = PHASE_KEYS.includes(phaseParam) ? summary.phases.find((p) => p.key === phaseParam) || null : null;
  const openItem = itemParam ? itemsById.get(itemParam) || null : null;

  // Tidy the URL once the data is in: a business that no longer exists, a
  // phase that is not one, or a work item that was deleted.
  useEffect(() => {
    if (loading || loadError) return;
    const patch = {};
    if (businessParam && !businesses.some((b) => b.id === businessParam)) patch.b = null;
    if (phaseParam && !openPhase) patch.phase = null;
    if (itemParam && !openItem) patch.item = null;
    if (Object.keys(patch).length) setParams(patch);
  }, [loading, loadError, businessParam, businesses, phaseParam, openPhase, itemParam, openItem, setParams]);

  /* ── navigation ──────────────────────────────────────── */

  const goToPhase = useCallback(
    (key) => {
      setParams({ phase: key, item: null }, { push: true });
      window.scrollTo({ top: 0 });
    },
    [setParams],
  );
  const goToOverview = useCallback(() => {
    setParams({ phase: null, item: null }, { push: true });
    window.scrollTo({ top: 0 });
  }, [setParams]);
  // Opening a work item also opens the phase it belongs to, behind it.
  const goToItem = useCallback((item) => setParams({ phase: item.phase, item: item.id }, { push: true }), [setParams]);
  const closeItem = useCallback(() => setParams({ item: null }), [setParams]);

  /* ── state helpers ───────────────────────────────────── */

  const patchData = useCallback((fn) => setData((prev) => fn(prev)), []);
  const withActivity = (prev, rows = []) => [...rows, ...prev.activity].slice(0, LIMITS.activity);
  const replaceItem = (list, next) => list.map((item) => (item.id === next.id ? next : item));

  /* ── work items ──────────────────────────────────────── */

  const setItemStatus = async (item, status) => {
    if (item.status === status) return;
    // Blocked work cannot start: show what it waits on instead.
    if (status !== "not_started" && summary.statuses.get(item.id) === "blocked") {
      goToItem(item);
      return;
    }
    // What this change does to the rest of the business, to say so afterwards.
    const after = summarize({ phases, items: replaceItem(items, { ...item, status }), dependencies });
    const wasBlocked = (other) => summary.statuses.get(other.id) === "blocked";
    const isBlocked = (other) => after.statuses.get(other.id) === "blocked";
    const unlocked = items.filter((other) => wasBlocked(other) && !isBlocked(other));
    const reblocked = items.filter((other) => !wasBlocked(other) && isBlocked(other));

    patchData((prev) => ({ ...prev, items: replaceItem(prev.items, { ...item, status }) }));
    try {
      const res = await businessApi("/api/business/items", { method: "PATCH", body: { id: item.id, status } });
      patchData((prev) => ({ ...prev, items: replaceItem(prev.items, res.item), activity: withActivity(prev, res.activity) }));

      const phaseAfter = after.phases.find((p) => p.key === item.phase);
      const phaseBefore = summary.phases.find((p) => p.key === item.phase);
      // One toast at a time: ticking through a list should not stack them up.
      const say = { id: "business-status" };
      if (after.open === 0 && summary.open > 0) toast.success("Every phase is complete. Time for the next loop.", say);
      else if (phaseAfter?.status === "completed" && phaseBefore?.status !== "completed") toast.success(`${phaseAfter.name} is complete.`, say);
      else if (status === "completed" && unlocked.length) toast.success(`Unlocked ${namesOf(unlocked)}.`, say);
      else if (reblocked.length) toast(`${plural(reblocked.length, "work item")} ${reblocked.length === 1 ? "is" : "are"} blocked again.`, say);
    } catch (e) {
      patchData((prev) => ({ ...prev, items: prev.items.map((other) => (other.id === item.id ? { ...other, status: item.status } : other)) }));
      toast.error(e.message || "Could not update the work item.");
      // The server knows about a prerequisite this page does not: catch up.
      if (e.code === "blocked") load(business?.id);
    }
  };

  const updateItem = async (id, patch) => {
    const before = itemsById.get(id);
    if (!before) return false;
    patchData((prev) => ({ ...prev, items: replaceItem(prev.items, { ...before, ...patch }) }));
    try {
      const res = await businessApi("/api/business/items", { method: "PATCH", body: { id, ...patch } });
      patchData((prev) => ({ ...prev, items: replaceItem(prev.items, res.item) }));
      return true;
    } catch (e) {
      patchData((prev) => ({ ...prev, items: replaceItem(prev.items, before) }));
      toast.error(e.message || "Could not save the work item.");
      return false;
    }
  };

  const createItem = async ({ phase, area, title }) => {
    try {
      const res = await businessApi("/api/business/items", { method: "POST", body: { businessId: business.id, phase, area, title } });
      patchData((prev) => ({
        ...prev,
        items: [...prev.items, res.item],
        dependencies: [...prev.dependencies, ...res.dependencies],
        activity: withActivity(prev, res.activity),
      }));
      return true;
    } catch (e) {
      toast.error(e.message || "Could not add the work item.");
      return false;
    }
  };

  const deleteItem = async (item) => {
    const waiting = dependentsOf(item.id, summary.graph).length;
    const ok = window.confirm(
      `Delete "${item.title}"?${waiting ? ` ${plural(waiting, "work item")} waiting on it will no longer be held back by it.` : ""}`,
    );
    if (!ok) return;
    try {
      const res = await businessApi("/api/business/items", { method: "DELETE", body: { id: item.id } });
      if (itemParam === item.id) closeItem();
      patchData((prev) => ({
        ...prev,
        items: prev.items.filter((other) => other.id !== res.deletedId),
        dependencies: prev.dependencies.filter((d) => d.item !== res.deletedId && d.dependsOn !== res.deletedId),
        activity: withActivity(prev, res.activity),
      }));
      toast.success("Work item deleted.");
    } catch (e) {
      toast.error(e.message || "Could not delete the work item.");
    }
  };

  /* ── dependencies ────────────────────────────────────── */

  const addDependency = async (itemId, dependsOnId) => {
    try {
      const res = await businessApi("/api/business/dependencies", { method: "POST", body: { item: itemId, dependsOn: dependsOnId } });
      patchData((prev) => ({
        ...prev,
        dependencies: prev.dependencies.some((d) => d.id === res.dependency.id) ? prev.dependencies : [...prev.dependencies, res.dependency],
        activity: withActivity(prev, res.activity),
      }));
    } catch (e) {
      toast.error(e.message || "Could not add the prerequisite.");
    }
  };

  const removeDependency = async (edge) => {
    patchData((prev) => ({ ...prev, dependencies: prev.dependencies.filter((d) => d.id !== edge.id) }));
    try {
      const res = await businessApi("/api/business/dependencies", { method: "DELETE", body: { id: edge.id } });
      patchData((prev) => ({ ...prev, activity: withActivity(prev, res.activity) }));
    } catch (e) {
      patchData((prev) => ({ ...prev, dependencies: [...prev.dependencies, edge] }));
      toast.error(e.message || "Could not remove the prerequisite.");
    }
  };

  /* ── metrics ─────────────────────────────────────────── */

  const saveMetric = async (id, patch) => {
    try {
      const res = await businessApi("/api/business/metrics", { method: "PATCH", body: { id, ...patch } });
      patchData((prev) => ({
        ...prev,
        metrics: prev.metrics.map((m) => (m.id === id ? res.metric : m)),
        activity: withActivity(prev, res.activity),
      }));
      return true;
    } catch (e) {
      toast.error(e.message || "Could not save the metric.");
      return false;
    }
  };

  const createMetric = async (fields) => {
    try {
      const res = await businessApi("/api/business/metrics", { method: "POST", body: { businessId: business.id, ...fields } });
      patchData((prev) => ({ ...prev, metrics: [...prev.metrics, res.metric] }));
      return true;
    } catch (e) {
      toast.error(e.message || "Could not add the metric.");
      return false;
    }
  };

  const deleteMetric = async (metric) => {
    if (!window.confirm(`Delete the metric "${metric.label}" and its history?`)) return false;
    try {
      await businessApi("/api/business/metrics", { method: "DELETE", body: { id: metric.id } });
      patchData((prev) => ({ ...prev, metrics: prev.metrics.filter((m) => m.id !== metric.id) }));
      return true;
    } catch (e) {
      toast.error(e.message || "Could not delete the metric.");
      return false;
    }
  };

  /* ── improvement loops ───────────────────────────────── */

  const startLoop = async (title) => {
    try {
      const res = await businessApi("/api/business/loops", { method: "POST", body: { businessId: business.id, title } });
      patchData((prev) => ({
        ...prev,
        business: res.business,
        items: [...prev.items, ...res.items],
        dependencies: [...prev.dependencies, ...res.dependencies],
        activity: withActivity(prev, res.activity),
      }));
      toast.success("Loop started: one step added to every phase.");
      return true;
    } catch (e) {
      toast.error(e.message || "Could not start the loop.");
      return false;
    }
  };

  const removeLoop = async (loop) => {
    if (!window.confirm(`Remove the loop "${loop.title}" and its ${plural(loop.total, "step")}?`)) return;
    try {
      const res = await businessApi("/api/business/loops", { method: "DELETE", body: { businessId: business.id, loopId: loop.id } });
      const gone = new Set(res.deletedItemIds);
      if (itemParam && gone.has(itemParam)) closeItem();
      patchData((prev) => ({
        ...prev,
        business: res.business,
        items: prev.items.filter((item) => !gone.has(item.id)),
        dependencies: prev.dependencies.filter((d) => !gone.has(d.item) && !gone.has(d.dependsOn)),
        activity: withActivity(prev, res.activity),
      }));
    } catch (e) {
      toast.error(e.message || "Could not remove the loop.");
    }
  };

  /* ── the business itself ─────────────────────────────── */

  const createBusiness = async (fields) => {
    try {
      const snapshot = await businessApi("/api/business", { method: "POST", body: fields });
      loadedRef.current = snapshot.business.id;
      setData(snapshot);
      setDialog(null);
      setParams({ b: snapshot.businesses.length > 1 ? snapshot.business.id : null, phase: null, item: null });
      toast.success(`${snapshot.business.name} is set up: ${plural(snapshot.items.length, "work item")} across six phases.`);
    } catch (e) {
      toast.error(e.message || "Could not create the business.");
    }
  };

  const updateBusiness = async (fields) => {
    try {
      const res = await businessApi("/api/business", { method: "PATCH", body: { id: business.id, ...fields } });
      patchData((prev) => ({
        ...prev,
        business: res.business,
        businesses: prev.businesses.map((b) => (b.id === res.business.id ? { ...b, name: res.business.name } : b)),
        activity: withActivity(prev, res.activity),
      }));
      setDialog(null);
    } catch (e) {
      toast.error(e.message || "Could not save the business.");
    }
  };

  const deleteBusiness = async () => {
    const ok = window.confirm(
      `Delete "${business.name}" with its ${plural(items.length, "work item")}, metrics and history? This cannot be undone.`,
    );
    if (!ok) return;
    try {
      await businessApi("/api/business", { method: "DELETE", body: { id: business.id } });
      toast.success("Business deleted.");
      setParams({ b: null, phase: null, item: null });
      await load(null);
    } catch (e) {
      toast.error(e.message || "Could not delete the business.");
    }
  };

  /* ── render ──────────────────────────────────────────── */

  let content;
  if (loading && !business) {
    content = (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-fg-muted">
        <Spinner className="w-4 h-4" />
        Loading your business…
      </div>
    );
  } else if (loadError) {
    content = (
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-danger/40 bg-danger-soft text-danger text-sm" role="alert">
        <IconAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1">{loadError}</div>
        <ActionButton size="sm" onClick={() => load(businessParam)}>
          Retry
        </ActionButton>
      </div>
    );
  } else if (!business) {
    content = <CreateBusiness onCreate={createBusiness} />;
  } else if (openPhase) {
    const panels = phaseMeta(openPhase.key)?.panels || [];
    content = (
      <PhaseWorkspace
        phase={openPhase}
        summary={summary}
        items={items}
        highlightedId={itemParam}
        onBack={goToOverview}
        onOpenPhase={goToPhase}
        onOpenItem={goToItem}
        onSetStatus={setItemStatus}
        onAddItem={createItem}
      >
        {panels.includes("metrics") ? (
          <div>
            <BlockTitle hint="The numbers behind this phase. Tap one to record a new value.">Business health</BlockTitle>
            <MetricsPanel mode="all" metrics={metrics} currency={business.currency} onSave={saveMetric} onCreate={createMetric} onDelete={deleteMetric} />
          </div>
        ) : null}
        {panels.includes("loops") ? (
          <CyclePanel
            phases={summary.phases}
            loops={loops}
            cycle={business.cycle}
            allDone={summary.total > 0 && summary.open === 0}
            onOpenPhase={goToPhase}
            onOpenItem={goToItem}
            onStartLoop={startLoop}
            onRemoveLoop={removeLoop}
          />
        ) : null}
      </PhaseWorkspace>
    );
  } else {
    content = (
      <BusinessOverview
        business={business}
        summary={summary}
        loops={loops}
        metrics={metrics}
        activity={activity}
        itemsById={itemsById}
        onOpenPhase={goToPhase}
        onOpenItem={goToItem}
        onSetStatus={setItemStatus}
        onSaveMetric={saveMetric}
        onCreateMetric={createMetric}
        onDeleteMetric={deleteMetric}
        onStartLoop={startLoop}
        onRemoveLoop={removeLoop}
      />
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent leading-tight">
              Business
            </h1>
            {adminOnly ? (
              <Link
                href="/admin?tab=subscriptions"
                title="Nobody else can see Business. Add it to a plan under Admin > Subscriptions."
                data-testid="business-admin-only"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-edge bg-surface-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted hover:text-fg hover:border-edge-strong transition-colors"
              >
                <IconLock className="w-3 h-3" />
                Admin only
              </Link>
            ) : null}
            {/* Switching business or catching up with the server: the page stays, this turns. */}
            {loading && business ? <Spinner className="w-4 h-4 text-fg-subtle" /> : null}
          </div>
          <p className="text-xs sm:text-sm text-fg-muted mt-0.5 truncate" data-testid="business-subtitle">
            {business
              ? `${business.name} · ${businessTypeMeta(business.type).label}${business.description ? ` · ${business.description}` : ""}`
              : "Create, set up, run, measure and keep improving a business."}
          </p>
        </div>
        {business ? (
          <div className="flex items-center gap-2 shrink-0">
            {businesses.length > 1 ? (
              <Dropdown
                id="business-switcher"
                value={business.id}
                options={businesses.map((b) => ({ value: b.id, label: b.name }))}
                onChange={(id) => id !== business.id && setParams({ b: id, phase: null, item: null }, { push: true })}
                align="end"
                menuLabel="Your businesses"
                showDot={false}
              />
            ) : null}
            <PopoverMenu
              label="Business options"
              className="!p-2 border border-edge bg-surface"
              items={[
                { label: "Edit business", Icon: IconEdit, onClick: () => setDialog("edit") },
                {
                  label: "New business",
                  Icon: IconPlus,
                  onClick: () => setDialog("create"),
                  disabled: businesses.length >= LIMITS.businesses,
                  hint: businesses.length >= LIMITS.businesses ? `max ${LIMITS.businesses}` : undefined,
                },
                { divider: true },
                { label: "Delete business", Icon: IconTrash, danger: true, onClick: deleteBusiness },
              ]}
            />
          </div>
        ) : null}
      </div>

      {content}

      {business ? (
        <WorkItemDialog
          item={openItem}
          items={items}
          dependencies={dependencies}
          summary={summary}
          onClose={closeItem}
          onOpenItem={goToItem}
          onSetStatus={setItemStatus}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onAddDependency={addDependency}
          onRemoveDependency={removeDependency}
        />
      ) : null}

      <ModalShell
        open={dialog === "create" || (dialog === "edit" && !!business)}
        onClose={() => setDialog(null)}
        title={dialog === "edit" ? "Edit business" : "New business"}
        subtitle={dialog === "edit" ? undefined : "It gets its own six phases, work items and metrics"}
        size="lg"
      >
        <div className="px-5 py-4">
          {dialog === "edit" ? (
            <BusinessForm key={`edit-${business?.id}`} initial={business} submitLabel="Save" onSubmit={updateBusiness} onCancel={() => setDialog(null)} />
          ) : (
            <BusinessForm key="create" onSubmit={createBusiness} onCancel={() => setDialog(null)} />
          )}
        </div>
      </ModalShell>
    </div>
  );
}
