"use client";

// Add or edit one budget entry, with what the quick add row leaves out: the
// day, a note, projected income and how it repeats (every N months, on one
// or more days, until an optional end; src/lib/budget/repeat.js). A one-time
// entry only needs a day: its month is the one on screen. Changing the rule
// of a repeating entry applies from that entry on; deleting one asks whether
// to remove only it or it and every later one.

import React, { useEffect, useState } from "react";
import ModalShell from "@/components/planner/ModalShell";
import Dropdown from "@/components/ui/Dropdown";
import {
  BUDGET_LIMITS,
  ENTRY_CHOICES,
  categoriesOf,
  choiceOf,
  formatMoney,
  kindFor,
  kindMeta,
  kindsOf,
} from "@/lib/budget/categories";
import { addMonths, daysInMonth, isoDate, monthLabel, payDayOf, shortDate } from "@/lib/budget/engine";
import {
  INTERVAL_OPTIONS,
  REPEAT_LIMITS,
  REPEAT_PRESETS,
  applyPreset,
  describeRepeat,
  normalizeDays,
  presetOf,
} from "@/lib/budget/repeat";
import {
  ActionButton,
  Banner,
  ChoiceButtons,
  Field,
  TYPE_TEXT,
  Toggle,
  categoryOptions,
  inputClass,
} from "@/components/budget/budgetUi";

const EMPTY = {
  type: "expense",
  kind: "bill",
  title: "",
  amount: "",
  category: "",
  day: null,
  note: "",
  projected: false,
};

const parseAmount = (text) => Number(String(text).replace(",", "."));

/**
 * Asked when projected income is ticked as received: how much actually came
 * in, starting from the estimate.
 */
export function ReceiveDialog({ entry, currency, onClose, onConfirm }) {
  const [amount, setAmount] = useState("");
  useEffect(() => {
    if (entry) setAmount(String(entry.amount));
  }, [entry]);
  const value = parseAmount(amount);
  const valid = amount !== "" && Number.isFinite(value) && value >= 0;
  const confirm = () => {
    if (!valid) return;
    onConfirm(entry, Math.round(value * 100) / 100);
    onClose();
  };
  return (
    <ModalShell
      open={Boolean(entry)}
      onClose={onClose}
      size="sm"
      title="How much came in?"
      subtitle={entry ? `${entry.title} · estimated ${formatMoney(entry.amount, currency)}` : null}
      bodyClassName="px-5 py-4"
      footer={
        <div className="w-full flex items-center justify-end gap-2">
          <ActionButton tone="ghost" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton tone="primary" onClick={confirm} disabled={!valid}>
            Mark received
          </ActionButton>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirm();
        }}
        className="space-y-2"
      >
        <Field label={`Actual amount (${currency})`}>
          <input
            className={inputClass}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            autoFocus
            data-testid="budget-receive-amount"
          />
        </Field>
        <p className="text-xs text-fg-muted">
          It counts as income from now on. Untick it if it does not come in after all: it goes back to projected at the
          estimate and leaves the left over.
        </p>
      </form>
    </ModalShell>
  );
}

/**
 * When an entry is paid: any date from its own month up to
 * BUDGET_LIMITS.maxDelay months later. A later month moves it out of its own
 * month's totals into that month's; its own date puts it back.
 */
export function PayDateDialog({ entry, currency, onClose, onConfirm }) {
  const [date, setDate] = useState("");
  const first = entry ? isoDate(entry.month, 1) : "";
  const lastMonth = entry ? addMonths(entry.month, BUDGET_LIMITS.maxDelay) : "";
  const last = entry ? isoDate(lastMonth, daysInMonth(lastMonth)) : "";
  useEffect(() => {
    if (entry) setDate(isoDate(entry.payMonth, payDayOf(entry) || entry.day || 1));
  }, [entry]);
  const valid = Boolean(date) && date >= first && date <= last;
  const pick = (month, day) => {
    onConfirm(entry, month, day);
    onClose();
  };
  const confirm = () => {
    if (valid) pick(date.slice(0, 7), Number(date.slice(8)));
  };
  // Quick picks: the same day one or two months on, clamped to short months.
  const quick = entry
    ? [1, 2].map((n) => {
        const month = addMonths(entry.month, n);
        const day = Math.min(entry.day || 1, daysInMonth(month));
        return { month, day, label: shortDate(month, day) };
      })
    : [];
  return (
    <ModalShell
      open={Boolean(entry)}
      onClose={onClose}
      size="sm"
      title="When is it paid?"
      subtitle={entry ? `${entry.title} · ${formatMoney(entry.amount, currency)}` : null}
      bodyClassName="px-5 py-4"
      footer={
        <div className="w-full flex items-center justify-end gap-2">
          <ActionButton tone="ghost" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton tone="primary" onClick={confirm} disabled={!valid}>
            Set date
          </ActionButton>
        </div>
      }
    >
      {entry ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
          className="space-y-3"
        >
          <Field label="Pay date">
            <input
              type="date"
              className={inputClass}
              min={first}
              max={last}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="budget-pay-date"
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            <ActionButton size="sm" tone="outline" onClick={() => pick(entry.month, null)}>
              Its own date{entry.day ? ` (${shortDate(entry.month, entry.day)})` : ""}
            </ActionButton>
            {quick.map((q) => (
              <ActionButton key={q.month} size="sm" tone="outline" onClick={() => pick(q.month, q.day)}>
                {q.label}
              </ActionButton>
            ))}
          </div>
          <p className="text-xs text-fg-muted">
            Paid in a later month, it stays listed in {monthLabel(entry.month)} but counts in the month you pick.
          </p>
        </form>
      ) : null}
    </ModalShell>
  );
}

/**
 * Days of the month as a grid of buttons: one day for a one-time entry (its
 * month is the one being looked at), several for a repeating one (the same
 * days every time it runs, so no month or year). Tapping the chosen day
 * again clears it.
 */
function DayGrid({ value, onChange, max = 31, multiple = false, limit = REPEAT_LIMITS.days, label }) {
  const chosen = new Set(value);
  const toggle = (day) => {
    if (!multiple) return onChange(chosen.has(day) ? [] : [day]);
    if (chosen.has(day)) return onChange(value.filter((d) => d !== day));
    if (value.length >= limit) return;
    onChange(normalizeDays([...value, day]));
  };
  return (
    <div className="grid grid-cols-7 gap-1" role="group" aria-label={label} data-testid="budget-day-grid">
      {Array.from({ length: max }, (_, i) => i + 1).map((day) => {
        const on = chosen.has(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(day)}
            className={`h-8 rounded-lg text-xs font-semibold tabular-nums transition-colors ${
              on ? "bg-primary text-primary-fg" : "bg-surface-2 text-fg-muted hover:bg-surface-hover hover:text-fg"
            }`}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

/** How a repeating entry repeats: presets, every N months, its days and an optional end. */
function RepeatEditor({ rule, onChange, startDate }) {
  const set = (patch) => onChange({ ...rule, ...patch });
  const preset = presetOf(rule);
  return (
    <div className="space-y-3 p-3 rounded-xl border border-edge bg-surface-2/50" data-testid="budget-repeat">
      <div className="flex flex-wrap gap-1.5">
        {REPEAT_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={preset === p.key}
            onClick={() => onChange(applyPreset(rule, p.key))}
            className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${
              preset === p.key ? "bg-primary-soft border-primary/40 text-primary" : "border-edge text-fg-muted hover:text-fg hover:bg-surface-hover"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span
          className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${
            preset ? "border-transparent text-fg-subtle" : "bg-primary-soft border-primary/40 text-primary"
          }`}
        >
          Custom
        </span>
      </div>

      <Field label="How often">
        <Dropdown
          block
          showDot={false}
          value={rule.interval}
          options={INTERVAL_OPTIONS}
          onChange={(interval) => set({ interval: Number(interval) || 1 })}
          custom={{ min: 1, max: REPEAT_LIMITS.interval, unit: "months", label: "Every…" }}
          menuLabel="How often"
        />
      </Field>

      <Field
        label="On these days"
        hint={`Up to ${REPEAT_LIMITS.days}, for more than once a month. None: no set day. A day a short month lacks falls on its last day.`}
      >
        <DayGrid multiple value={rule.days} onChange={(days) => set({ days })} label="Days of the month" />
      </Field>

      <Field label="Ends">
        <div className="space-y-2">
          <ChoiceButtons
            label="Ends"
            value={rule.endDate ? "on" : "never"}
            onChange={(v) => set({ endDate: v === "on" ? rule.endDate || startDate : null })}
            options={[
              { value: "never", label: "No end" },
              { value: "on", label: "On a date" },
            ]}
          />
          {rule.endDate ? (
            <input
              type="date"
              className={inputClass}
              min={startDate}
              value={rule.endDate}
              onChange={(e) => e.target.value && set({ endDate: e.target.value })}
              aria-label="End date"
            />
          ) : null}
        </div>
      </Field>

      <p className="text-xs font-medium text-fg" data-testid="budget-repeat-summary">
        {describeRepeat(rule)}
      </p>
    </div>
  );
}

const sameDays = (a, b) => normalizeDays(a).join(",") === normalizeDays(b).join(",");

export default function EntryDialog({
  open,
  entry = null,
  draft = null,
  startOnDelete = false,
  rule: currentRule = null,
  month,
  categories,
  currency,
  onClose,
  onSave,
  onDelete,
}) {
  const editing = Boolean(entry);
  const [form, setForm] = useState(EMPTY);
  const [repeats, setRepeats] = useState(false);
  const [rule, setRule] = useState({ interval: 1, days: [], endDate: null });
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    const source = entry || { ...EMPTY, ...(draft || {}) };
    setForm({
      type: source.type || "expense",
      kind: kindFor(source.type || "expense", source.kind),
      title: source.title || "",
      amount: source.amount === "" || source.amount == null ? "" : String(source.amount),
      category: source.category || "",
      day: source.day || null,
      note: source.note || "",
      projected: Boolean(source.projected),
    });
    const repeating = Boolean(entry?.series && currentRule);
    setRepeats(repeating);
    setRule(
      repeating
        ? { interval: currentRule.interval, days: currentRule.days, endDate: currentRule.endDate }
        : { interval: 1, days: source.day ? [source.day] : [], endDate: null },
    );
    setApplyToSeries(false);
    setConfirmDelete(Boolean(entry && startOnDelete));
    setError(null);
  }, [open, entry, draft, startOnDelete, currentRule]);

  // A new type has categories of its own. Checked against the latest form,
  // so it never overrides the entry the dialog has just been opened with.
  useEffect(() => {
    if (!open) return;
    setForm((f) => {
      const own = categoriesOf(categories, f.type);
      return own.some((c) => c.key === f.category) ? f : { ...f, category: own[0]?.key || "" };
    });
  }, [open, categories, form.type, form.category]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const amount = parseAmount(form.amount);
  const entryMonth = entry?.month || month;
  const maxDay = daysInMonth(entryMonth);
  const wasRepeating = Boolean(entry?.series && currentRule);
  // A rule edited on an entry starts from that entry; a new one from its month.
  const startDate = editing ? isoDate(entryMonth, entry.day || 1) : isoDate(entryMonth, 1);
  const ruleChanged =
    repeats !== wasRepeating ||
    (repeats &&
      wasRepeating &&
      (rule.interval !== currentRule.interval || !sameDays(rule.days, currentRule.days) || (rule.endDate || null) !== (currentRule.endDate || null)));
  const valid =
    form.title.trim() &&
    form.amount !== "" &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    form.category &&
    (!repeats || !rule.endDate || rule.endDate >= startDate);

  const toggleRepeats = (on) => {
    setRepeats(on);
    // The day picked so far carries over between the two pickers.
    if (on && !rule.days.length && form.day) setRule((r) => ({ ...r, days: [form.day] }));
    if (!on && !form.day && rule.days.length) set({ day: Math.min(rule.days[0], maxDay) });
  };

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const fields = {
      title: form.title.trim(),
      amount,
      category: form.category,
      note: form.note.trim(),
      projected: form.type === "income" && form.projected,
      ...(kindsOf(form.type).length ? { kind: form.kind } : {}),
    };
    const repeat = repeats ? { interval: rule.interval, days: normalizeDays(rule.days), endDate: rule.endDate || null } : null;
    try {
      if (!editing) {
        await onSave({ ...fields, type: form.type, month, ...(repeat ? { repeat } : { day: form.day }) });
      } else {
        await onSave({
          id: entry.id,
          ...fields,
          ...(repeats ? {} : { day: form.day }),
          ...(ruleChanged ? { repeat } : {}),
          ...(wasRepeating && repeats && !ruleChanged ? { applyToSeries } : {}),
        });
      }
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (scope) => {
    setBusy(true);
    setError(null);
    try {
      await onDelete(entry, scope);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const footer = confirmDelete ? (
    <div className="w-full flex flex-wrap items-center justify-end gap-2">
      <span className="mr-auto text-xs text-fg-muted">
        {entry?.series ? "This entry repeats." : "Delete this entry?"}
      </span>
      <ActionButton tone="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
        Keep it
      </ActionButton>
      {entry?.series ? (
        <>
          <ActionButton tone="outline" onClick={() => remove("one")} busy={busy}>
            Only this one
          </ActionButton>
          <ActionButton tone="danger" onClick={() => remove("future")} busy={busy}>
            This and later ones
          </ActionButton>
        </>
      ) : (
        <ActionButton tone="danger" onClick={() => remove("one")} busy={busy}>
          Delete
        </ActionButton>
      )}
    </div>
  ) : (
    <div className="w-full flex items-center justify-end gap-2">
      {editing ? (
        <ActionButton tone="ghost" className="mr-auto text-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
          Delete
        </ActionButton>
      ) : null}
      <ActionButton tone="ghost" onClick={onClose} disabled={busy}>
        Cancel
      </ActionButton>
      <ActionButton tone="primary" onClick={save} disabled={!valid} busy={busy}>
        {editing ? "Save" : "Add"}
      </ActionButton>
    </div>
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={editing ? "Edit entry" : "New entry"}
      subtitle={monthLabel(entryMonth)}
      footer={footer}
      bodyClassName="px-5 py-4"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {error ? <Banner tone="danger">{error}</Banner> : null}

        {/* New: what it is, the kinds included. Editing keeps the type and
            only switches between its kinds. */}
        {!editing ? (
          <Field label="What is it?" hint={kindMeta(form.type, form.kind)?.hint}>
            <ChoiceButtons
              label="What is it?"
              value={choiceOf(form.type, form.kind).key}
              onChange={(key) => {
                const c = ENTRY_CHOICES.find((x) => x.key === key);
                set({ type: c.type, kind: c.kind });
              }}
              options={ENTRY_CHOICES.map((c) => ({ value: c.key, label: c.label, textClass: TYPE_TEXT[c.type] }))}
            />
          </Field>
        ) : kindsOf(form.type).length ? (
          <Field label="Kind" hint={kindMeta(form.type, form.kind)?.hint}>
            <ChoiceButtons
              label="Kind"
              value={form.kind}
              onChange={(kind) => set({ kind })}
              options={kindsOf(form.type).map((k) => ({ value: k.key, label: k.label, textClass: TYPE_TEXT[form.type] }))}
            />
          </Field>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-3">
          <Field label="Name">
            <input className={inputClass} value={form.title} maxLength={BUDGET_LIMITS.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
          </Field>
          <Field label={`Amount (${currency})`}>
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value.replace(/[^\d.,]/g, "") })}
            />
          </Field>
        </div>

        <Field label="Category">
          <Dropdown
            block
            showDot={false}
            value={form.category}
            options={categoryOptions(categories, form.type)}
            onChange={(category) => set({ category })}
            menuLabel="Category"
          />
        </Field>

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-fg">Repeats</p>
            <p className="text-xs text-fg-muted">
              {editing && wasRepeating
                ? "Changing how it repeats applies from this one on; earlier ones stay as they were."
                : "Rent, salary, a quarterly bill: every month, every few months or several times a month."}
            </p>
          </div>
          <Toggle checked={repeats} onChange={toggleRepeats} label="Repeats" />
        </div>

        {repeats ? (
          <RepeatEditor rule={rule} onChange={setRule} startDate={startDate} />
        ) : (
          <Field label="Day" hint={`Optional. In ${monthLabel(entryMonth)}.`}>
            <DayGrid value={form.day ? [form.day] : []} onChange={(days) => set({ day: days[0] || null })} max={maxDay} label="Day" />
          </Field>
        )}

        <Field label="Note">
          <input className={inputClass} value={form.note} maxLength={BUDGET_LIMITS.note} onChange={(e) => set({ note: e.target.value })} placeholder="Optional" />
        </Field>

        {form.type === "income" ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-fg">Projected income</p>
              <p className="text-xs text-fg-muted">Money that may not come in. It is kept apart from your income until you mark it received.</p>
            </div>
            <Toggle checked={form.projected} onChange={(v) => set({ projected: v })} label="Projected income" />
          </div>
        ) : null}

        {wasRepeating && repeats && !ruleChanged ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-fg">Also change later ones</p>
              <p className="text-xs text-fg-muted">
                The later ones that are not {entry.type === "income" ? "received" : "paid"} yet get the same name, amount and category.
              </p>
            </div>
            <Toggle checked={applyToSeries} onChange={setApplyToSeries} label="Also change later ones" />
          </div>
        ) : null}

        {editing && entry.payMonth !== entry.month ? (
          <p className="text-xs text-fg-muted">
            Paid on {shortDate(entry.payMonth, payDayOf(entry))}, so it counts in {monthLabel(entry.payMonth)}, not in its own month
            {Number.isFinite(amount) ? ` (${formatMoney(amount, currency)})` : ""}.
          </p>
        ) : null}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </ModalShell>
  );
}
