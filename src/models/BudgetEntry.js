import mongoose from "mongoose";

// Income, an expense or an investment in the personal budget. It belongs to
// `month` and counts in `payMonth`, which is later than `month` once the
// payment is delayed (see src/lib/budget/engine.js). `done` is paid,
// received or done, by type. `kind` splits expenses into bills and debt
// (null for the other types). `projected` is income that may not happen;
// receiving it records the actual `amount` and keeps the estimate in
// `projectedAmount`, so un-ticking it makes it projected again. `series`
// names the BudgetSeries a repeating entry was made from and `occ` which of
// its occurrences it is; `skipped` keeps a removed occurrence from being
// made again.

const budgetEntrySchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    type: { type: String, enum: ["income", "expense", "investment"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    kind: { type: String, enum: ["bill", "debt", "investment", "saving", null], default: null },
    note: { type: String, default: "", maxlength: 300 },
    month: { type: String, required: true },
    payMonth: { type: String, required: true },
    // The day it is paid, once a pay date was chosen; null pays it on `day`.
    payDay: { type: Number, default: null, min: 1, max: 31 },
    day: { type: Number, default: null, min: 1, max: 31 },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
    projected: { type: Boolean, default: false },
    projectedAmount: { type: Number, default: null },
    series: { type: mongoose.Schema.Types.ObjectId, ref: "BudgetSeries", default: null },
    // Which occurrence of the series this is: its ISO date, or its month when undated.
    occ: { type: String, default: null },
    skipped: { type: Boolean, default: false },
  },
  { timestamps: true },
);

budgetEntrySchema.index({ user: 1, month: 1 });
budgetEntrySchema.index({ user: 1, payMonth: 1 });
// One entry per occurrence. (The index on { series, month } it replaced is
// dropped by migrateBudget().)
budgetEntrySchema.index(
  { series: 1, occ: 1 },
  { unique: true, partialFilterExpression: { series: { $type: "objectId" } } },
);

export default mongoose.models.BudgetEntry || mongoose.model("BudgetEntry", budgetEntrySchema);
