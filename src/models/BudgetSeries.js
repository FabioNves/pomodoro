import mongoose from "mongoose";

// A budget entry that repeats (rent, salary, a quarterly bill). It is a
// template plus a rule (src/lib/budget/repeat.js): every `interval` months
// from the month of `startDate`, on each of `days`, until `endDate` (null
// for no end). The months a reader looks at get a real BudgetEntry per
// occurrence (materializeSeries in src/lib/budget/server.js), so each one can
// be paid, moved or changed on its own. `day`, `startMonth` and `endMonth`
// are the shape before rules: migrateBudget() turns them into the rule.

const budgetSeriesSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    type: { type: String, enum: ["income", "expense", "investment"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    kind: { type: String, enum: ["bill", "debt", "investment", "saving", null], default: null },
    projected: { type: Boolean, default: false },
    note: { type: String, default: "", maxlength: 300 },
    interval: { type: Number, default: 1, min: 1, max: 24 },
    days: { type: [Number], default: [] },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    day: { type: Number, default: null },
    startMonth: { type: String, default: null },
    endMonth: { type: String, default: null },
  },
  { timestamps: true },
);

export default mongoose.models.BudgetSeries || mongoose.model("BudgetSeries", budgetSeriesSchema);
