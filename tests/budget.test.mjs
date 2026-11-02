import test from "node:test";
import assert from "node:assert/strict";
import { addMonths, cashFlow, monthsBetween, monthSummary, payDayOf, shortDate, yearSummary, totalsOf } from "../src/lib/budget/engine.js";

const entry = (over) => ({
  id: Math.random().toString(36).slice(2),
  type: "expense",
  title: "x",
  amount: 100,
  category: "food",
  month: "2026-10",
  payMonth: "2026-10",
  day: null,
  done: false,
  projected: false,
  series: null,
  ...over,
});

test("months step across years", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-10", 14), "2027-12");
  assert.equal(monthsBetween("2026-10", "2027-01"), 3);
});

test("a delayed expense shows in its month without counting, and counts in the month it moved to", () => {
  const rent = entry({ title: "Rent", amount: 800, payMonth: "2026-11" });
  const food = entry({ title: "Food", amount: 200 });
  const oct = monthSummary([rent, food], "2026-10");
  assert.equal(oct.totals.expenses, 200);
  assert.deepEqual(oct.delayed.map((e) => e.title), ["Rent"]);
  assert.equal(oct.delayedTotal, 800);
  const nov = monthSummary([rent], "2026-11");
  assert.equal(nov.totals.expenses, 800);
  assert.equal(nov.delayed.length, 0);
});

test("projected income is kept apart from income and left over", () => {
  const t = totalsOf([
    entry({ type: "income", amount: 3000, category: "salary", done: true }),
    entry({ type: "income", amount: 500, category: "side_income", projected: true }),
    entry({ type: "expense", amount: 1200, done: true }),
    entry({ type: "expense", amount: 300 }),
    entry({ type: "investment", amount: 400, category: "stocks" }),
  ]);
  assert.equal(t.income, 3000);
  assert.equal(t.projected, 500);
  assert.equal(t.expenses, 1500);
  assert.equal(t.paid, 1200);
  assert.equal(t.toPay, 300);
  assert.equal(t.invested, 400);
  assert.equal(t.leftOver, 1100);
  assert.equal(t.leftOverWithProjected, 1600);
  assert.equal(t.savingsRate, 0.5);
});

test("the year counts every entry in the month it is paid", () => {
  const rows = [
    entry({ month: "2026-01", payMonth: "2026-01", type: "income", category: "salary", amount: 2000 }),
    entry({ month: "2026-01", payMonth: "2026-02", amount: 100 }),
    entry({ month: "2026-12", payMonth: "2027-01", amount: 50 }),
  ];
  const y = yearSummary(rows, 2026);
  assert.equal(y.months[0].expenses, 0);
  assert.equal(y.months[1].expenses, 100);
  assert.equal(y.months[11].expenses, 0);
  assert.equal(y.totals.expenses, 100);
  assert.equal(y.totals.income, 2000);
  assert.equal(y.categoryRows[0].months[1], 100);
});

test("expenses split into bills and debt; entries without a kind are bills", () => {
  const t = totalsOf([
    entry({ amount: 800 }),
    entry({ amount: 150, kind: "bill" }),
    entry({ amount: 250, kind: "debt", category: "loans" }),
  ]);
  assert.equal(t.expenses, 1200);
  assert.equal(t.bills, 950);
  assert.equal(t.debt, 250);
});

test("projected income that was received counts; put back to projected it leaves the left over", () => {
  const received = entry({ type: "income", category: "side_income", amount: 420, done: true, projected: false, projectedAmount: 500 });
  assert.equal(totalsOf([received]).leftOver, 420);
  const unticked = { ...received, done: false, projected: true, amount: received.projectedAmount, projectedAmount: null };
  const t = totalsOf([unticked]);
  assert.equal(t.leftOver, 0);
  assert.equal(t.projected, 500);
});

test("money put aside splits into investments and savings", () => {
  const t = totalsOf([
    entry({ type: "investment", category: "stocks", amount: 300 }),
    entry({ type: "investment", category: "savings", kind: "saving", amount: 200 }),
  ]);
  assert.equal(t.invested, 500);
  assert.equal(t.investments, 300);
  assert.equal(t.savings, 200);
});

test("a pay date moves the day an entry is listed and paid on", () => {
  assert.equal(payDayOf(entry({ day: 12 })), 12);
  assert.equal(payDayOf(entry({ day: 12, payDay: 20 })), 20);
  assert.equal(payDayOf(entry({ day: 12, payMonth: "2026-11" })), null);
  assert.equal(payDayOf(entry({ day: 12, payMonth: "2026-11", payDay: 5 })), 5);
  assert.equal(shortDate("2026-11", 5), "5 Nov");
});

test("cash flow runs the balance day by day and keeps projected income on its own line", () => {
  const flow = cashFlow(
    [
      entry({ type: "income", category: "salary", amount: 2000, day: 25 }),
      entry({ amount: 800, day: 1 }),
      entry({ amount: 100, day: 10, payDay: 15 }),
      entry({ type: "income", category: "side_income", amount: 300, day: 20, projected: true }),
      entry({ amount: 50, month: "2026-09", payMonth: "2026-10", payDay: 3 }),
    ],
    "2026-10",
  );
  assert.equal(flow.days.length, 31);
  assert.equal(flow.days[0].balance, -800);
  assert.equal(flow.days[2].balance, -850);
  assert.equal(flow.days[14].balance, -950);
  assert.equal(flow.lowest.balance, -950);
  assert.equal(flow.days[19].balanceWithProjected, -650);
  assert.equal(flow.end, 1050);
  assert.equal(flow.days[30].balanceWithProjected, 1350);
});

test("the year adds the left over up month by month", () => {
  const y = yearSummary(
    [
      entry({ month: "2026-01", payMonth: "2026-01", type: "income", category: "salary", amount: 1000 }),
      entry({ month: "2026-02", payMonth: "2026-02", amount: 300 }),
    ],
    2026,
  );
  assert.equal(y.months[0].running, 1000);
  assert.equal(y.months[1].running, 700);
  assert.equal(y.months[11].running, 700);
});
