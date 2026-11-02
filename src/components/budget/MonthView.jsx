"use client";

// One month of the budget: the totals, a quick add row, the month's entries
// by type and the ones moved to a later month. Every number comes from
// monthSummary() in src/lib/budget/engine.js.

import React, { useEffect, useMemo, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import {
  BUDGET_LIMITS,
  ENTRY_CHOICES,
  categoriesOf,
  categoryLabel,
  entryLabel,
  entryTypeMeta,
  formatMoney,
  kindOf,
  kindsOf,
} from "@/lib/budget/categories";
import { compareEntries, isDelayed, monthLabel, payDayOf, shortDate } from "@/lib/budget/engine";
import { describeRepeat } from "@/lib/budget/repeat";
import {
  ActionButton,
  Badge,
  DoneCheck,
  IconDelay,
  IconEdit,
  IconPlus,
  IconRepeat,
  IconTrash,
  IconUndo,
  Panel,
  PopoverMenu,
  SERIES,
  TYPE_BORDER,
  Tile,
  categoryOptions,
  choiceOptions,
  inputClass,
} from "@/components/budget/budgetUi";

const percent = (n) => `${Math.round(n * 100)}%`;

const PLACEHOLDERS = {
  income: "Salary, a client…",
  bill: "Rent, groceries…",
  debt: "Car loan, credit card…",
  investment: "ETF, pension…",
  saving: "Emergency fund, holiday…",
};

export function MonthTotals({ summary, currency }) {
  const t = summary.totals;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      <Tile
        label="Income"
        type="income"
        swatch={SERIES.income.color}
        amount={t.income}
        currency={currency}
        testId="budget-total-income"
        sub={t.projected > 0 ? `+ ${formatMoney(t.projected, currency)} projected` : t.toReceive > 0 ? `${formatMoney(t.toReceive, currency)} still to receive` : "All received"}
      />
      <Tile
        label="Expenses"
        type="expense"
        swatch={SERIES.expenses.color}
        amount={t.expenses}
        currency={currency}
        testId="budget-total-expenses"
        sub={t.toPay > 0 ? `${formatMoney(t.toPay, currency)} still to pay` : t.expenses > 0 ? "All paid" : "Nothing yet"}
        extra={t.debt > 0 ? `${formatMoney(t.bills, currency)} bills · ${formatMoney(t.debt, currency)} debt` : null}
      />
      <Tile
        label={SERIES.invested.label}
        type="investment"
        swatch={SERIES.invested.color}
        amount={t.invested}
        currency={currency}
        testId="budget-total-invested"
        sub={t.income > 0 ? `${percent(t.invested / t.income)} of income` : null}
        extra={t.savings > 0 ? `${formatMoney(t.savings, currency)} saved · ${formatMoney(t.investments, currency)} invested` : null}
      />
      <Tile
        label="Left over"
        amount={t.leftOver}
        currency={currency}
        tone={t.leftOver < 0 ? "negative" : "neutral"}
        testId="budget-total-left"
        sub={
          t.projected > 0
            ? `${formatMoney(t.leftOverWithProjected, currency)} if projected comes in`
            : t.savingsRate !== null
              ? `${percent(t.savingsRate)} of income not spent`
              : null
        }
      />
    </div>
  );
}

function QuickAdd({ month, categories, onAdd, onMore }) {
  const [choice, setChoice] = useState("bill");
  const { type, kind } = ENTRY_CHOICES.find((c) => c.key === choice);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const options = useMemo(() => categoriesOf(categories, type), [categories, type]);
  const [category, setCategory] = useState(options[0]?.key || "");
  const [busy, setBusy] = useState(false);

  // A new type has categories of its own.
  useEffect(() => {
    if (!options.some((c) => c.key === category)) setCategory(options[0]?.key || "");
  }, [options, category]);

  const value = Number(String(amount).replace(",", "."));
  const valid = title.trim() && Number.isFinite(value) && value >= 0 && amount !== "" && category;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onAdd({ type, ...(kind ? { kind } : {}), title: title.trim(), amount: value, category, month });
    setBusy(false);
    if (ok) {
      setTitle("");
      setAmount("");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2" data-testid="budget-quick-add">
      <div className="w-36">
        <Dropdown block value={choice} options={choiceOptions()} onChange={setChoice} menuLabel="What is it?" />
      </div>
      <input
        className={`${inputClass} flex-1 min-w-[9rem] !rounded-full`}
        placeholder={PLACEHOLDERS[choice]}
        value={title}
        maxLength={BUDGET_LIMITS.title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Name"
      />
      <input
        className={`${inputClass} !w-28 !rounded-full`}
        inputMode="decimal"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
        aria-label="Amount"
      />
      <div className="w-44">
        <Dropdown block showDot={false} value={category} options={categoryOptions(categories, type)} onChange={setCategory} menuLabel="Category" />
      </div>
      <ActionButton type="submit" tone="primary" Icon={IconPlus} disabled={!valid} busy={busy}>
        Add
      </ActionButton>
      <ActionButton
        tone="ghost"
        onClick={() => onMore({ type, kind, title: title.trim(), amount: amount === "" ? "" : value, category })}
        title="Day, note, projected income, how it repeats"
      >
        More…
      </ActionButton>
    </form>
  );
}

function EntryRow({ entry, month, categories, currency, actions, rules = {}, showType = false }) {
  const meta = entryTypeMeta(entry.type);
  const delayedIn = entry.payMonth === month && isDelayed(entry);
  const delayedOut = entry.month === month && entry.payMonth !== month;
  const payDay = payDayOf(entry);
  const moved = isDelayed(entry) || (entry.payDay && entry.payDay !== entry.day);
  // The date the row shows: when it is paid, or its own date in the month it left.
  const date = delayedOut ? (entry.day ? shortDate(entry.month, entry.day) : null) : payDay ? shortDate(entry.payMonth, payDay) : null;

  const menu = [
    !entry.done ? { label: "Change pay date…", Icon: IconDelay, onClick: () => actions.reschedule(entry) } : null,
    !entry.done && moved
      ? { label: `Back to ${shortDate(entry.month, entry.day)}`, Icon: IconUndo, onClick: () => actions.payOn(entry, entry.month, null) }
      : null,
    { label: "Edit", Icon: IconEdit, onClick: () => actions.edit(entry) },
    { divider: true },
    { label: entry.series ? "Delete…" : "Delete", Icon: IconTrash, danger: true, onClick: () => actions.remove(entry) },
  ];

  return (
    <li
      className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-hover/60 ${delayedOut ? "opacity-60" : ""} ${
        showType ? `border-l-4 rounded-l-md ${TYPE_BORDER[entry.type]}` : ""
      }`}
      data-testid="budget-entry"
      data-entry-id={entry.id}
    >
      <DoneCheck entry={entry} onToggle={() => actions.toggleDone(entry)} disabled={delayedOut} />
      <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-fg-muted" data-testid="budget-entry-date">
        {date || <span className="text-fg-subtle/60">–</span>}
      </span>
      <button type="button" onClick={() => actions.edit(entry)} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-sm font-medium truncate ${entry.done ? "text-fg-muted line-through decoration-fg-subtle/60" : "text-fg"}`}>
            {entry.title}
          </span>
          {entry.projected ? (
            <Badge tone="accent" title="May not happen: not counted as income until received">
              Projected
            </Badge>
          ) : null}
          {entry.series ? (
            <span className="text-fg-subtle" title={describeRepeat(rules[entry.series]) || "Repeats"}>
              <IconRepeat className="w-3 h-3" />
            </span>
          ) : null}
          {delayedIn ? (
            <Badge tone="warning" title={`Belongs to ${monthLabel(entry.month)}, paid this month`}>
              From {shortDate(entry.month, entry.day)}
            </Badge>
          ) : null}
          {delayedOut ? (
            <Badge tone="warning" title="Counts in the month it is paid">
              Paying {shortDate(entry.payMonth, entry.payDay)}
            </Badge>
          ) : null}
          {!isDelayed(entry) && moved && entry.day ? (
            <Badge tone="warning" title={`Its own date is ${shortDate(entry.month, entry.day)}`}>
              Moved from {entry.day}
            </Badge>
          ) : null}
        </div>
        <div className="text-[11px] text-fg-subtle truncate">
          {showType ? `${entryLabel(entry)} · ` : ""}
          {categoryLabel(categories, entry.category)}
          {entry.done ? ` · ${meta.doneLabel}` : ""}
          {entry.projectedAmount != null ? ` · estimated ${formatMoney(entry.projectedAmount, currency)}` : ""}
          {entry.note ? ` · ${entry.note}` : ""}
        </div>
      </button>
      <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${entry.projected ? "text-fg-muted" : "text-fg"}`}>
        {formatMoney(entry.amount, currency)}
      </span>
      {delayedOut ? (
        <button
          type="button"
          onClick={() => actions.payOn(entry, entry.month, null)}
          className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-hover"
          title={`Back to ${monthLabel(entry.month)}`}
          aria-label={`Back to ${monthLabel(entry.month)}`}
        >
          <IconUndo className="w-4 h-4" />
        </button>
      ) : null}
      <PopoverMenu items={menu} label={`More for ${entry.title}`} />
    </li>
  );
}

function EntryList({ entries, ...rest }) {
  return (
    <ul className="-mx-2">
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} {...rest} />
      ))}
    </ul>
  );
}

/** A type with kinds as one list per kind (bills and debt; investments and savings), each with its total. */
function KindLists({ type, entries, currency, ...rest }) {
  const doneLabel = entryTypeMeta(type).doneLabel.toLowerCase();
  return (
    <div className="space-y-3">
      {kindsOf(type).map((k) => {
        const list = entries.filter((e) => kindOf(e) === k.key);
        const total = list.reduce((s, e) => s + e.amount, 0);
        const done = list.filter((e) => e.done).reduce((s, e) => s + e.amount, 0);
        return (
          <div key={k.key} data-testid={`budget-kind-${k.key}`}>
            <div className="flex items-center justify-between gap-2 py-1 border-b border-edge">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                {k.plural} <span className="font-normal">{list.length}</span>
              </span>
              <span className="text-xs text-fg-muted">
                <span className="font-semibold text-fg tabular-nums">{formatMoney(total, currency)}</span>
                {list.length ? <span className="hidden sm:inline"> · {formatMoney(done, currency)} {doneLabel}</span> : null}
              </span>
            </div>
            {list.length ? (
              <EntryList entries={list} currency={currency} {...rest} />
            ) : (
              <p className="text-xs text-fg-subtle py-2">No {k.plural.toLowerCase()} this month.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TypeGroup({ type, entries, month, categories, currency, actions, rules }) {
  const meta = entryTypeMeta(type);
  const real = entries.filter((e) => !e.projected);
  const total = real.reduce((s, e) => s + e.amount, 0);
  const done = real.filter((e) => e.done).reduce((s, e) => s + e.amount, 0);
  const projected = entries.filter((e) => e.projected).reduce((s, e) => s + e.amount, 0);
  const listProps = { month, categories, currency, actions, rules };
  return (
    <Panel
      type={type}
      title={
        <span className="inline-flex items-center gap-2">
          {meta.plural}
          <span className="text-xs font-normal text-fg-subtle">{entries.length}</span>
        </span>
      }
      action={
        <div className="text-right text-xs text-fg-muted">
          <span className="font-semibold text-fg tabular-nums">{formatMoney(total, currency)}</span>
          {real.length ? <span className="hidden sm:inline"> · {formatMoney(done, currency)} {meta.doneLabel.toLowerCase()}</span> : null}
          {projected > 0 ? <span className="block sm:inline sm:ml-1">+ {formatMoney(projected, currency)} projected</span> : null}
        </div>
      }
    >
      {kindsOf(type).length ? (
        <KindLists type={type} entries={entries} {...listProps} />
      ) : entries.length ? (
        <EntryList entries={entries} {...listProps} />
      ) : (
        <p className="text-xs text-fg-subtle py-2">Nothing this month.</p>
      )}
    </Panel>
  );
}

export default function MonthView({ summary, categories, currency, actions, rules = {} }) {
  const byType = useMemo(() => {
    const groups = { income: [], expense: [], investment: [] };
    for (const e of [...summary.counted].sort(compareEntries)) groups[e.type]?.push(e);
    return groups;
  }, [summary.counted]);
  const delayed = useMemo(() => [...summary.delayed].sort(compareEntries), [summary.delayed]);
  const groupProps = { month: summary.month, categories, currency, actions, rules };

  return (
    <div className="space-y-4">
      <MonthTotals summary={summary} currency={currency} />

      <Panel>
        <div className="pt-4">
          <QuickAdd month={summary.month} categories={categories} onAdd={actions.create} onMore={actions.createWith} />
        </div>
      </Panel>

      <div className="grid gap-4 items-start lg:grid-cols-2 2xl:grid-cols-3">
        <TypeGroup type="income" entries={byType.income} {...groupProps} />
        <TypeGroup type="expense" entries={byType.expense} {...groupProps} />
        <TypeGroup type="investment" entries={byType.investment} {...groupProps} />
      </div>

      {delayed.length ? (
        <Panel
          title="Moved to a later month"
          action={
            <span className="text-xs text-fg-muted">
              <span className="font-semibold text-fg tabular-nums">{formatMoney(summary.delayedTotal, currency)}</span> not counted here
            </span>
          }
        >
          <ul className="-mx-2" data-testid="budget-delayed">
            {delayed.map((entry) => (
              <EntryRow key={entry.id} entry={entry} {...groupProps} showType />
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
