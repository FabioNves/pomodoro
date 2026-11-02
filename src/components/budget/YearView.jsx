"use client";

// The year at a glance: its totals, twelve months in one chart, the same
// months as a table (a row opens that month) and the expense categories by
// month. Numbers come from yearSummary() in src/lib/budget/engine.js.

import React from "react";
import { categoryLabel, formatMoney } from "@/lib/budget/categories";
import { monthLabel } from "@/lib/budget/engine";
import { Panel, SERIES, Tile } from "@/components/budget/budgetUi";
import { YearChart } from "@/components/budget/BudgetCharts";

const cell = "py-1.5 px-2 text-right tabular-nums whitespace-nowrap";

export default function YearView({ summary, categories, currency, currentMonth, onOpenMonth }) {
  const t = summary.totals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Tile
          label="Income"
          type="income"
          swatch={SERIES.income.color}
          amount={t.income}
          currency={currency}
          sub={t.projected > 0 ? `+ ${formatMoney(t.projected, currency)} projected` : null}
        />
        <Tile
          label="Expenses"
          type="expense"
          swatch={SERIES.expenses.color}
          amount={t.expenses}
          currency={currency}
          sub={summary.averageExpenses ? `${formatMoney(summary.averageExpenses, currency)} a month on average` : null}
          extra={t.debt > 0 ? `${formatMoney(t.debt, currency)} of it debt` : null}
        />
        <Tile
          label={SERIES.invested.label}
          type="investment"
          swatch={SERIES.invested.color}
          amount={t.invested}
          currency={currency}
          sub={t.income > 0 ? `${Math.round((t.invested / t.income) * 100)}% of income` : null}
          extra={t.savings > 0 ? `${formatMoney(t.savings, currency)} saved` : null}
        />
        <Tile
          label="Left over"
          amount={t.leftOver}
          currency={currency}
          tone={t.leftOver < 0 ? "negative" : "neutral"}
          sub={summary.best ? `Best month: ${monthLabel(summary.best.month, { short: true, withYear: false })}` : null}
        />
      </div>

      <Panel title={`${summary.year} month by month`}>
        <YearChart months={summary.months} currency={currency} />
      </Panel>

      <Panel title="Months">
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm" data-testid="budget-year-table">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-fg-subtle">
                <th className="text-left font-semibold py-1 px-2">Month</th>
                <th className={`${cell} font-semibold`}>Income</th>
                <th className={`${cell} font-semibold hidden sm:table-cell`}>Projected</th>
                <th className={`${cell} font-semibold`}>Expenses</th>
                <th className={`${cell} font-semibold hidden sm:table-cell`}>Debt</th>
                <th className={`${cell} font-semibold`}>Saved &amp; invested</th>
                <th className={`${cell} font-semibold`}>Left over</th>
                <th className={`${cell} font-semibold`} title="Left over added up from January">Cash flow</th>
              </tr>
            </thead>
            <tbody>
              {summary.months.map((m) => (
                <tr
                  key={m.month}
                  onClick={() => onOpenMonth(m.month)}
                  className={`border-t border-edge cursor-pointer hover:bg-surface-hover ${m.count ? "" : "text-fg-subtle"}`}
                  title={`Open ${monthLabel(m.month)}`}
                >
                  <td className="py-1.5 px-2 font-medium">
                    {monthLabel(m.month, { withYear: false })}
                    {m.month === currentMonth ? <span className="ml-1.5 text-[10px] font-semibold text-primary">Now</span> : null}
                  </td>
                  <td className={cell}>{formatMoney(m.income, currency)}</td>
                  <td className={`${cell} hidden sm:table-cell text-fg-muted`}>{m.projected ? formatMoney(m.projected, currency) : "–"}</td>
                  <td className={cell}>{formatMoney(m.expenses, currency)}</td>
                  <td className={`${cell} hidden sm:table-cell text-fg-muted`}>{m.debt ? formatMoney(m.debt, currency) : "–"}</td>
                  <td className={cell}>{formatMoney(m.invested, currency)}</td>
                  <td className={`${cell} font-semibold ${m.leftOver < 0 ? "text-danger" : ""}`}>{formatMoney(m.leftOver, currency)}</td>
                  <td className={`${cell} ${m.running < 0 ? "text-danger" : "text-fg-muted"}`}>{formatMoney(m.running, currency)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-edge-strong font-semibold">
                <td className="py-1.5 px-2">Total</td>
                <td className={cell}>{formatMoney(t.income, currency)}</td>
                <td className={`${cell} hidden sm:table-cell`}>{t.projected ? formatMoney(t.projected, currency) : "–"}</td>
                <td className={cell}>{formatMoney(t.expenses, currency)}</td>
                <td className={`${cell} hidden sm:table-cell`}>{t.debt ? formatMoney(t.debt, currency) : "–"}</td>
                <td className={cell}>{formatMoney(t.invested, currency)}</td>
                <td className={`${cell} ${t.leftOver < 0 ? "text-danger" : ""}`}>{formatMoney(t.leftOver, currency)}</td>
                <td className={cell} />
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {summary.categoryRows.length ? (
        <Panel title="Expenses by category">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs" data-testid="budget-year-categories">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-fg-subtle">
                  <th className="text-left font-semibold py-1 px-2 sticky left-0 bg-surface">Category</th>
                  {summary.months.map((m) => (
                    <th key={m.month} className={`${cell} font-semibold`}>
                      {monthLabel(m.month, { short: true, withYear: false })}
                    </th>
                  ))}
                  <th className={`${cell} font-semibold`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.categoryRows.map((row) => (
                  <tr key={row.category} className="border-t border-edge">
                    <td className="py-1.5 px-2 font-medium text-fg whitespace-nowrap sticky left-0 bg-surface">
                      {categoryLabel(categories, row.category)}
                    </td>
                    {row.months.map((amount, i) => (
                      <td key={summary.months[i].month} className={`${cell} ${amount ? "text-fg" : "text-fg-subtle"}`}>
                        {amount ? formatMoney(amount, currency, { compact: true }) : "–"}
                      </td>
                    ))}
                    <td className={`${cell} font-semibold text-fg`}>{formatMoney(row.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
