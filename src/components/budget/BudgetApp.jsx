"use client";

// Personal Budget, the Operations section: data, the URL and the updates.
// Its place is in the query string beside ?section=budget: ?view=month|graphs|year,
// ?month=YYYY-MM (month and graphs) and ?year=YYYY. Paid/received and
// a new pay date change the screen at once and roll back if the server refuses;
// anything else reloads the period, because a repeating entry can change
// several months at a time.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import BrandLoader from "@/components/brand/BrandLoader";
import { budgetApi } from "@/lib/budget/client";
import { BUDGET_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/budget/categories";
import { addMonths, isMonthKey, monthKeyOf, monthLabel, monthSummary, shortDate, yearSummary } from "@/lib/budget/engine";
import MonthView from "@/components/budget/MonthView";
import YearView from "@/components/budget/YearView";
import Dropdown from "@/components/ui/Dropdown";
import EntryDialog, { PayDateDialog, ReceiveDialog } from "@/components/budget/EntryDialog";
import CategoriesDialog from "@/components/budget/CategoriesDialog";
import { MonthCharts } from "@/components/budget/BudgetCharts";
import {
  ActionButton,
  Banner,
  IconLeft,
  IconRight,
  IconTag,
  Segmented,
  Spinner,
} from "@/components/budget/budgetUi";

const VIEWS = [
  { value: "month", label: "Month" },
  { value: "graphs", label: "Graphs" },
  { value: "year", label: "Year" },
];

export default function BudgetApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = monthKeyOf();
  const view = VIEWS.some((v) => v.value === searchParams.get("view")) ? searchParams.get("view") : "month";
  const month = isMonthKey(searchParams.get("month")) ? searchParams.get("month") : today;
  const yearParam = Number(searchParams.get("year"));
  const year = Number.isInteger(yearParam) && yearParam >= 1970 && yearParam <= 9999 ? yearParam : Number(month.slice(0, 4));
  const period = view === "year" ? `year=${year}` : `month=${month}`;

  const [settings, setSettings] = useState(null);
  const [entries, setEntries] = useState([]);
  const [rules, setRules] = useState({}); // series id → repeat rule, for the entries on screen
  const [loadedPeriod, setLoadedPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dialog, setDialog] = useState(null); // { entry?, draft?, startOnDelete? }
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [receiving, setReceiving] = useState(null); // projected income being marked received
  const [rescheduling, setRescheduling] = useState(null); // entry whose pay date is being chosen
  const requestRef = useRef(0);
  const pendingQueryRef = useRef(null);

  // Changes build on the last query asked for until the router catches up,
  // as in Business, so two quick changes never undo each other.
  useEffect(() => {
    pendingQueryRef.current = null;
  }, [searchParams]);

  const setParams = useCallback(
    (patch) => {
      const params = new URLSearchParams(pendingQueryRef.current ?? searchParams.toString());
      params.set("section", "budget");
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, String(value));
      }
      pendingQueryRef.current = params.toString();
      router.replace(`/operations?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const load = useCallback(async () => {
    const id = ++requestRef.current;
    setLoading(true);
    try {
      const data = await budgetApi(`/api/budget?${period}`);
      if (id !== requestRef.current) return;
      setSettings(data.settings);
      setEntries(data.entries);
      setRules(Object.fromEntries((data.series || []).map((s) => [s.id, s])));
      setLoadedPeriod(period);
      setLoadError(null);
    } catch (error) {
      if (id !== requestRef.current) return;
      setLoadError(error.message);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = settings?.currency || DEFAULT_CURRENCY;
  const categories = useMemo(() => settings?.categories || [], [settings]);
  // Until the new period arrives the old one stays on screen, under the spinner.
  const shownView = loadedPeriod?.startsWith("year=") ? "year" : view === "year" ? "month" : view;
  const shownMonth = loadedPeriod?.startsWith("month=") ? loadedPeriod.slice(6) : month;
  const shownYear = loadedPeriod?.startsWith("year=") ? Number(loadedPeriod.slice(5)) : year;
  const monthData = useMemo(() => monthSummary(entries, shownMonth), [entries, shownMonth]);
  const yearData = useMemo(() => yearSummary(entries, shownYear), [entries, shownYear]);

  /* ── updates ─────────────────────────────────────────── */

  const patchLocal = (id, patch) => setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const optimistic = async (entry, patch, body) => {
    patchLocal(entry.id, patch);
    try {
      const data = await budgetApi("/api/budget/entries", { method: "PATCH", body: { id: entry.id, ...body } });
      patchLocal(entry.id, data.entry);
    } catch (error) {
      patchLocal(entry.id, entry);
      toast.error(error.message);
    }
  };

  const actions = {
    // Projected income asks how much actually came in first; un-ticking it
    // again puts it back to projected at its estimate, out of the left over.
    toggleDone: (entry) => {
      if (!entry.done && entry.projected) {
        setReceiving(entry);
        return;
      }
      if (entry.done && entry.projectedAmount != null) {
        optimistic(entry, { done: false, projected: true, amount: entry.projectedAmount, projectedAmount: null }, { done: false });
        return;
      }
      optimistic(entry, { done: !entry.done }, { done: !entry.done });
    },
    reschedule: (entry) => setRescheduling(entry),
    // Pay on a date: `day` null is no day of its own (its own date, in its own month).
    payOn: (entry, payMonth, day) => {
      const payDay = payMonth === entry.month && (day == null || day === entry.day) ? null : day;
      optimistic(entry, { payMonth, payDay }, { payMonth, payDay });
      if (payMonth !== entry.month) {
        toast.success(`Paying ${shortDate(payMonth, payDay)}: counts in ${monthLabel(payMonth)}`, { id: "budget-pay-date" });
      }
    },
    create: async (body) => {
      try {
        await budgetApi("/api/budget/entries", { method: "POST", body });
        await load();
        return true;
      } catch (error) {
        toast.error(error.message);
        return false;
      }
    },
    createWith: (draft) => setDialog({ draft }),
    edit: (entry) => setDialog({ entry }),
    remove: async (entry) => {
      if (entry.series) {
        setDialog({ entry, startOnDelete: true });
        return;
      }
      setEntries((list) => list.filter((e) => e.id !== entry.id));
      try {
        await budgetApi("/api/budget/entries", { method: "DELETE", body: { id: entry.id } });
        toast.success(`Deleted ${entry.title}`, { id: "budget-delete" });
      } catch (error) {
        toast.error(error.message);
        load();
      }
    },
  };

  const saveEntry = async (body) => {
    await budgetApi("/api/budget/entries", { method: body.id ? "PATCH" : "POST", body });
    await load();
  };

  const deleteEntry = async (entry, scope) => {
    await budgetApi("/api/budget/entries", { method: "DELETE", body: { id: entry.id, scope } });
    await load();
  };

  const setCurrency = async (code) => {
    const before = settings;
    setSettings((s) => ({ ...s, currency: code }));
    try {
      const data = await budgetApi("/api/budget/settings", { method: "PATCH", body: { currency: code } });
      setSettings(data.settings);
    } catch (error) {
      setSettings(before);
      toast.error(error.message);
    }
  };

  const categoryActions = {
    onAdd: async (label, type) => {
      const data = await budgetApi("/api/budget/categories", { method: "POST", body: { label, type } });
      setSettings(data.settings);
    },
    onRename: async (category, label) => {
      const data = await budgetApi("/api/budget/categories", { method: "PATCH", body: { key: category.key, label } });
      setSettings(data.settings);
    },
    onRemove: async (category) => {
      const data = await budgetApi("/api/budget/categories", { method: "DELETE", body: { key: category.key } });
      setSettings(data.settings);
      await load();
    },
  };

  /* ── header ──────────────────────────────────────────── */

  const step = (n) =>
    view === "year" ? setParams({ year: year + n, month: null }) : setParams({ month: addMonths(month, n), year: null });
  const atToday = view === "year" ? year === Number(today.slice(0, 4)) : month === today;
  const periodLabel = view === "year" ? String(year) : monthLabel(month);

  if (!settings && loading) return <BrandLoader />;

  return (
    <div className="w-full px-3 sm:px-4" data-testid="budget-app">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gradient-start to-gradient-end bg-clip-text text-transparent leading-tight">
              Personal Budget
            </h1>
            {loading ? <Spinner className="w-4 h-4 text-fg-subtle" /> : null}
          </div>
          <p className="text-xs sm:text-sm text-fg-muted mt-0.5">Income, expenses and investments, month by month.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            label="Currency"
            compact
            align="end"
            showDot={false}
            value={currency}
            options={BUDGET_CURRENCIES.map((code) => ({ value: code, label: code }))}
            onChange={(code) => code !== currency && setCurrency(code)}
          />
          <ActionButton Icon={IconTag} onClick={() => setCategoriesOpen(true)}>
            <span className="hidden sm:inline">Categories</span>
          </ActionButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <Segmented
          value={view}
          onChange={(v) => setParams(v === "year" ? { view: v, year: Number(month.slice(0, 4)) } : { view: v === "month" ? null : v })}
          options={VIEWS}
          label="Budget view"
          size="md"
        />
        <div className="flex items-center gap-1">
          {!atToday ? (
            <ActionButton tone="ghost" size="sm" onClick={() => setParams(view === "year" ? { year: Number(today.slice(0, 4)) } : { month: null })}>
              {view === "year" ? "This year" : "This month"}
            </ActionButton>
          ) : null}
          <button
            type="button"
            onClick={() => step(-1)}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover"
            aria-label={view === "year" ? "Previous year" : "Previous month"}
          >
            <IconLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-semibold text-fg" data-testid="budget-period">
            {periodLabel}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-hover"
            aria-label={view === "year" ? "Next year" : "Next month"}
          >
            <IconRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="mb-4">
          <Banner
            tone="danger"
            action={
              <ActionButton size="sm" onClick={load}>
                Try again
              </ActionButton>
            }
          >
            {loadError}
          </Banner>
        </div>
      ) : null}

      {settings ? (
        shownView === "year" ? (
          <YearView
            summary={yearData}
            categories={categories}
            currency={currency}
            currentMonth={today}
            onOpenMonth={(m) => setParams({ view: null, month: m, year: null })}
          />
        ) : shownView === "graphs" ? (
          <MonthCharts summary={monthData} categories={categories} currency={currency} />
        ) : (
          <MonthView summary={monthData} categories={categories} currency={currency} actions={actions} rules={rules} />
        )
      ) : null}

      <EntryDialog
        open={Boolean(dialog)}
        entry={dialog?.entry || null}
        draft={dialog?.draft || null}
        startOnDelete={Boolean(dialog?.startOnDelete)}
        rule={dialog?.entry?.series ? rules[dialog.entry.series] || null : null}
        month={shownMonth}
        categories={categories}
        currency={currency}
        onClose={() => setDialog(null)}
        onSave={saveEntry}
        onDelete={deleteEntry}
      />
      <PayDateDialog
        entry={rescheduling}
        currency={currency}
        onClose={() => setRescheduling(null)}
        onConfirm={actions.payOn}
      />
      <ReceiveDialog
        entry={receiving}
        currency={currency}
        onClose={() => setReceiving(null)}
        onConfirm={(entry, amount) =>
          optimistic(
            entry,
            { done: true, projected: false, amount, projectedAmount: entry.amount },
            { done: true, amount },
          )
        }
      />
      <CategoriesDialog
        open={categoriesOpen}
        categories={categories}
        onClose={() => setCategoriesOpen(false)}
        {...categoryActions}
      />
    </div>
  );
}
