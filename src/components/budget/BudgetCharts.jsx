"use client";

// Charts of the budget. Every chart has a legend or a title naming its one
// series, a tooltip, and a table beside it, so no figure is told by colour
// alone. Colours are SERIES (income green, expenses red, investments blue),
// the same everywhere.

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoryLabel, formatMoney } from "@/lib/budget/categories";
import { byCategory, cashFlow, monthKeyOf, monthLabel, shortDate } from "@/lib/budget/engine";
import { ChartTooltip, EmptyState, IconWallet, Legend, Panel, SERIES } from "@/components/budget/budgetUi";
import { MonthTotals } from "@/components/budget/MonthView";

const AXIS = { stroke: "var(--chart-axis)", fontSize: 11, tickLine: false, axisLine: false };
const percent = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");

/** Expenses by category, largest first, one bar colour: the bars are one series. */
function CategoryBars({ rows, currency }) {
  const height = Math.max(120, rows.length * 32 + 24);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" {...AXIS} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} />
          <YAxis type="category" dataKey="label" width={110} {...AXIS} />
          <Tooltip cursor={{ fill: "var(--surface-hover)" }} content={<ChartTooltip currency={currency} />} />
          <Bar dataKey="amount" name="Spent" fill={SERIES.expenses.color} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Where the month's income went: one bar, part to whole, labelled in the legend. */
function IncomeSplit({ totals, currency }) {
  const { income, expenses, invested, leftOver } = totals;
  if (income <= 0) {
    return <p className="text-xs text-fg-subtle py-2">No income counted this month yet.</p>;
  }
  const parts = [
    { key: "expenses", amount: expenses },
    { key: "invested", amount: invested },
    { key: "leftOver", amount: Math.max(0, leftOver) },
  ].filter((p) => p.amount > 0);
  const whole = Math.max(income, expenses + invested);
  return (
    <div className="space-y-3">
      <div className="flex h-4 w-full gap-0.5 rounded-full overflow-hidden bg-surface-2" role="img" aria-label="Where the income went">
        {parts.map((p) => (
          <div
            key={p.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(p.amount / whole) * 100}%`,
              background: p.key === "leftOver" ? "var(--border-strong)" : SERIES[p.key].color,
            }}
            title={`${SERIES[p.key].label}: ${formatMoney(p.amount, currency)}`}
          />
        ))}
      </div>
      <Legend
        items={[
          { label: SERIES.expenses.label, color: SERIES.expenses.color, value: `${formatMoney(expenses, currency)} · ${percent(expenses, income)}` },
          { label: SERIES.invested.label, color: SERIES.invested.color, value: `${formatMoney(invested, currency)} · ${percent(invested, income)}` },
          { label: SERIES.leftOver.label, color: "var(--border-strong)", value: `${formatMoney(leftOver, currency)} · ${percent(Math.max(0, leftOver), income)}` },
        ]}
      />
      {totals.debt > 0 ? (
        <p className="text-xs text-fg-muted">
          Of the expenses, {formatMoney(totals.bills, currency)} went to bills and {formatMoney(totals.debt, currency)} to debt.
        </p>
      ) : null}
      {leftOver < 0 ? (
        <p className="text-xs text-danger">
          {formatMoney(-leftOver, currency)} more went out than came in.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Cash flow: money in and out on the day it is paid, and the balance it
 * leaves from the start of the month. Bars go up for money in and down for
 * money out on one axis; the balance is a line, dashed for "if the projected
 * income comes in". Today is marked in the current month.
 */
function CashFlow({ entries, month, currency }) {
  const flow = cashFlow(entries, month);
  const today = new Date();
  const todayDay = monthKeyOf(today) === month ? today.getDate() : null;
  const data = flow.days.map((d) => ({ ...d, outNeg: d.out ? -d.out : 0 }));
  const legend = [
    { label: "In", color: SERIES.income.color },
    { label: "Out", color: SERIES.expenses.color },
    { label: "Balance", color: SERIES.leftOver.color, line: true },
  ];
  if (flow.hasProjected) legend.push({ label: "With projected", color: SERIES.leftOver.color, dashed: true });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_14rem]">
      <div className="space-y-3 min-w-0">
        <Legend items={legend} />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={0} barCategoryGap="20%" stackOffset="sign">
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="day" {...AXIS} interval="preserveStartEnd" minTickGap={12} />
              <YAxis {...AXIS} width={64} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} />
              <Tooltip
                cursor={{ fill: "var(--surface-hover)" }}
                content={<ChartTooltip currency={currency} labelFormatter={(day) => shortDate(month, day)} />}
              />
              <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.5} />
              {todayDay ? (
                <ReferenceLine x={todayDay} stroke="var(--primary)" strokeOpacity={0.6} label={{ value: "Today", position: "insideTopRight", fill: "var(--fg-muted)", fontSize: 10 }} />
              ) : null}
              <Bar dataKey="in" name="In" stackId="flow" fill={SERIES.income.color} radius={[4, 4, 0, 0]} maxBarSize={12} />
              <Bar dataKey="outNeg" name="Out" stackId="flow" fill={SERIES.expenses.color} radius={[0, 0, 4, 4]} maxBarSize={12} />
              {flow.hasProjected ? (
                <Line
                  dataKey="balanceWithProjected"
                  name="With projected"
                  type="stepAfter"
                  stroke={SERIES.leftOver.color}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
              ) : null}
              <Line dataKey="balance" name="Balance" type="stepAfter" stroke={SERIES.leftOver.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-1 gap-2 text-sm content-start" data-testid="budget-cash-flow">
        <div className="p-2.5 rounded-xl bg-surface-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">In</dt>
          <dd className="font-semibold text-fg tabular-nums">{formatMoney(flow.totalIn, currency)}</dd>
        </div>
        <div className="p-2.5 rounded-xl bg-surface-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Out</dt>
          <dd className="font-semibold text-fg tabular-nums">{formatMoney(flow.totalOut, currency)}</dd>
        </div>
        <div className="p-2.5 rounded-xl bg-surface-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">End of month</dt>
          <dd className={`font-semibold tabular-nums ${flow.end < 0 ? "text-danger" : "text-fg"}`}>{formatMoney(flow.end, currency)}</dd>
        </div>
        <div className="p-2.5 rounded-xl bg-surface-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Lowest point</dt>
          <dd className={`font-semibold tabular-nums ${flow.lowest?.balance < 0 ? "text-danger" : "text-fg"}`}>
            {formatMoney(flow.lowest?.balance ?? 0, currency)}
            {flow.lowest ? <span className="ml-1 text-xs font-normal text-fg-muted">on {shortDate(month, flow.lowest.day)}</span> : null}
          </dd>
        </div>
        <p className="col-span-2 lg:col-span-1 text-[11px] text-fg-subtle">
          Starts at 0 on the 1st. Entries without a date count on the 1st.
        </p>
      </dl>
    </div>
  );
}

/** The month's graphs view. */
export function MonthCharts({ summary, categories, currency }) {
  const expenseRows = byCategory(summary.counted, "expense").map((r) => ({ ...r, label: categoryLabel(categories, r.category) }));
  const investRows = byCategory(summary.counted, "investment").map((r) => ({ ...r, label: categoryLabel(categories, r.category) }));
  const totalExpenses = summary.totals.expenses;

  return (
    <div className="space-y-4">
      <MonthTotals summary={summary} currency={currency} />

      <Panel title="Cash flow">
        <CashFlow entries={summary.counted} month={summary.month} currency={currency} />
      </Panel>

      <Panel title="Where the income went">
        <IncomeSplit totals={summary.totals} currency={currency} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel title="Expenses by category">
          {expenseRows.length ? (
            <CategoryBars rows={expenseRows} currency={currency} />
          ) : (
            <EmptyState Icon={IconWallet} title="No expenses this month" hint="Add one in the Month view." />
          )}
        </Panel>
        <Panel title="By category">
          {expenseRows.length || investRows.length ? (
            <table className="w-full text-sm" data-testid="budget-category-table">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-fg-subtle">
                  <th className="text-left font-semibold py-1">Category</th>
                  <th className="text-right font-semibold py-1">Amount</th>
                  <th className="text-right font-semibold py-1 w-14">Share</th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.map((r) => (
                  <tr key={r.category} className="border-t border-edge">
                    <td className="py-1.5 text-fg">{r.label}</td>
                    <td className="py-1.5 text-right tabular-nums text-fg">{formatMoney(r.amount, currency)}</td>
                    <td className="py-1.5 text-right tabular-nums text-fg-muted">{percent(r.amount, totalExpenses)}</td>
                  </tr>
                ))}
                {investRows.length ? (
                  <tr>
                    <td colSpan={3} className="pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                      Saved &amp; invested
                    </td>
                  </tr>
                ) : null}
                {investRows.map((r) => (
                  <tr key={r.category} className="border-t border-edge">
                    <td className="py-1.5 text-fg">{r.label}</td>
                    <td className="py-1.5 text-right tabular-nums text-fg">{formatMoney(r.amount, currency)}</td>
                    <td className="py-1.5 text-right tabular-nums text-fg-muted">{percent(r.amount, summary.totals.invested)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-fg-subtle py-2">Nothing to show yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Twelve months of income, expenses and investments, with what was left over as a line. */
export function YearChart({ months, currency }) {
  const data = months.map((m) => ({ ...m, label: monthLabel(m.month, { short: true, withYear: false }) }));
  return (
    <div className="space-y-3">
      <Legend
        items={[
          { label: SERIES.income.label, color: SERIES.income.color },
          { label: SERIES.expenses.label, color: SERIES.expenses.color },
          { label: SERIES.invested.label, color: SERIES.invested.color },
          { label: SERIES.leftOver.label, color: SERIES.leftOver.color, line: true },
        ]}
      />
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} width={64} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} />
            <Tooltip cursor={{ fill: "var(--surface-hover)" }} content={<ChartTooltip currency={currency} />} />
            <Bar dataKey="income" name={SERIES.income.label} fill={SERIES.income.color} radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="expenses" name={SERIES.expenses.label} fill={SERIES.expenses.color} radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="invested" name={SERIES.invested.label} fill={SERIES.invested.color} radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Line
              dataKey="leftOver"
              name={SERIES.leftOver.label}
              type="monotone"
              stroke={SERIES.leftOver.color}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2, stroke: "var(--surface)", fill: SERIES.leftOver.color }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
