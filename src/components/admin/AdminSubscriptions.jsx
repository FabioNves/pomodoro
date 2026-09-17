"use client";

// Admin › Subscriptions: the feature registry (what each plan includes and
// the global switches) and the plan pricing. Saving drives the pricing page
// and the runtime gate at once.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { accessApi } from "@/lib/access/client";
import { BILLING_INTERVALS, CURRENCIES, PLAN_STATUSES, formatPrice } from "@/lib/access/features";
import { ActionButton, Chip, IconCheck, SectionTitle, Spinner, Toggle } from "@/components/news/newsUi";
import { IconCard, Table, Td, Tr, inputClass } from "@/components/admin/adminUi";

const STATUS_LABEL = { available: "Available", coming_soon: "Coming soon", hidden: "Hidden" };
const STATUS_TONE = { available: "success", coming_soon: "accent", hidden: "neutral" };

function PlanCard({ plan, onChange }) {
  const set = (patch) => onChange({ ...plan, ...patch });
  return (
    <div className="rounded-xl border border-edge bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-fg">{plan.name || plan.key}</p>
        <Chip tone={STATUS_TONE[plan.status]}>{STATUS_LABEL[plan.status]}</Chip>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-fg-muted space-y-1">
          <span>Name</span>
          <input value={plan.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} className={`${inputClass} w-full`} />
        </label>
        <label className="text-xs text-fg-muted space-y-1">
          <span>Tagline</span>
          <input value={plan.tagline} maxLength={120} onChange={(e) => set({ tagline: e.target.value })} className={`${inputClass} w-full`} />
        </label>
        <label className="text-xs text-fg-muted space-y-1">
          <span>Price</span>
          <input type="number" min="0" step="0.01" value={plan.price} onChange={(e) => set({ price: Number(e.target.value) })} className={`${inputClass} w-full`} />
        </label>
        <label className="text-xs text-fg-muted space-y-1">
          <span>Currency</span>
          <select value={plan.currency} onChange={(e) => set({ currency: e.target.value })} className={`${inputClass} w-full`}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-muted space-y-1">
          <span>Billing interval</span>
          <select value={plan.interval} onChange={(e) => set({ interval: e.target.value })} className={`${inputClass} w-full`}>
            {BILLING_INTERVALS.map((i) => (
              <option key={i} value={i}>
                per {i}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-muted space-y-1">
          <span>Status</span>
          <select value={plan.status} onChange={(e) => set({ status: e.target.value })} className={`${inputClass} w-full`}>
            {PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {plan.key === "premium" ? (
          <label className="text-xs text-fg-muted space-y-1 sm:col-span-2">
            <span>Checkout link (https, optional; the pricing page opens it when the plan is available)</span>
            <input type="url" placeholder="https://…" value={plan.checkoutUrl || ""} onChange={(e) => set({ checkoutUrl: e.target.value })} className={`${inputClass} w-full`} />
          </label>
        ) : null}
      </div>
      <p className="text-xs text-fg-subtle">
        Shown as <strong className="text-fg">{formatPrice(plan)}</strong> / {plan.interval}
      </p>
    </div>
  );
}

export default function AdminSubscriptions() {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accessApi("/api/admin/registry");
      setSaved(data.registry);
      setDraft(data.registry);
    } catch (error) {
      toast.error(error.message || "Could not load the feature registry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const patchFeature = (key, patch) =>
    setDraft((d) => ({ ...d, features: d.features.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
  const patchPlan = (key, plan) => setDraft((d) => ({ ...d, plans: { ...d.plans, [key]: plan } }));

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        features: draft.features.map(({ key, name, description, availableToFree, availableToPremium, enabled }) => ({
          key,
          name,
          description,
          availableToFree,
          availableToPremium,
          enabled,
        })),
        plans: Object.fromEntries(
          Object.entries(draft.plans).map(([k, p]) => [
            k,
            { name: p.name, tagline: p.tagline, price: Number(p.price) || 0, currency: p.currency, interval: p.interval, status: p.status, checkoutUrl: p.checkoutUrl || "" },
          ]),
        ),
      };
      const data = await accessApi("/api/admin/registry", { method: "PUT", body });
      setSaved(data.registry);
      setDraft(data.registry);
      toast.success("Saved. The pricing page and the feature gates now use these settings.");
    } catch (error) {
      toast.error(error.message || "Could not save the feature registry.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner /> Loading the feature registry…
      </p>
    );
  }

  const groups = [...new Set(draft.features.map((f) => f.group))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle Icon={IconCard}>Subscriptions</SectionTitle>
        <div className="flex items-center gap-3">
          {dirty ? <span className="text-xs text-fg-subtle">Unsaved changes</span> : null}
          <ActionButton size="sm" onClick={() => setDraft(saved)} disabled={!dirty || saving}>
            Discard
          </ActionButton>
          <ActionButton tone="primary" Icon={IconCheck} onClick={save} busy={saving} disabled={!dirty}>
            Save
          </ActionButton>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-fg">Features</p>
        <p className="text-xs text-fg-muted">
          The single source of truth. "Free" and "Premium" say which plan includes a feature; "Enabled" is the global switch. The admin can always use every enabled feature.
        </p>
        <Table
          columns={["Feature", "Description", { key: "free", label: "Free" }, { key: "premium", label: "Premium" }, { key: "enabled", label: "Enabled" }]}
          minWidth="52rem"
          caption="Feature registry"
        >
          {groups.map((group) => (
            <React.Fragment key={group}>
              <tr className="bg-surface-2/50">
                <td colSpan={5} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  {group}
                </td>
              </tr>
              {draft.features
                .filter((f) => f.group === group)
                .map((f) => (
                  <Tr key={f.key} className={!f.enabled ? "opacity-60" : ""}>
                    <Td>
                      <input aria-label={`Name of ${f.key}`} value={f.name} maxLength={80} onChange={(e) => patchFeature(f.key, { name: e.target.value })} className={`${inputClass} w-44 font-medium`} />
                      <p className="text-[11px] text-fg-subtle mt-0.5 font-mono">{f.key}</p>
                    </Td>
                    <Td>
                      <input aria-label={`Description of ${f.key}`} value={f.description} maxLength={300} onChange={(e) => patchFeature(f.key, { description: e.target.value })} className={`${inputClass} w-full min-w-[16rem]`} />
                    </Td>
                    <Td>
                      <Toggle checked={f.availableToFree} onChange={(v) => patchFeature(f.key, { availableToFree: v })} label={`${f.name} available to free`} />
                    </Td>
                    <Td>
                      <Toggle checked={f.availableToPremium} onChange={(v) => patchFeature(f.key, { availableToPremium: v })} label={`${f.name} available to premium`} />
                    </Td>
                    <Td>
                      <Toggle checked={f.enabled} onChange={(v) => patchFeature(f.key, { enabled: v })} label={`${f.name} enabled`} />
                    </Td>
                  </Tr>
                ))}
            </React.Fragment>
          ))}
        </Table>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-fg">Plans</p>
          <Link href="/pricing" className="text-xs font-medium text-primary hover:underline">
            Open the pricing page
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <PlanCard plan={draft.plans.free} onChange={(p) => patchPlan("free", p)} />
          <PlanCard plan={draft.plans.premium} onChange={(p) => patchPlan("premium", p)} />
        </div>
      </div>
    </div>
  );
}
