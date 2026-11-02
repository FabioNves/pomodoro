import mongoose from "mongoose";

// One per user: the budget's currency and its categories. The categories are
// copied from DEFAULT_CATEGORIES (src/lib/budget/categories.js) the first
// time the budget opens (ensureSettings), then belong to the user, who can
// rename, add and remove them.

const categorySchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: ["income", "expense", "investment"], required: true },
    custom: { type: Boolean, default: false },
  },
  { _id: false },
);

const budgetSettingsSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, unique: true },
    currency: { type: String, default: "EUR" },
    categories: { type: [categorySchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.models.BudgetSettings || mongoose.model("BudgetSettings", budgetSettingsSchema);
