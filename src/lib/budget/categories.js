// Personal Budget data shared with the browser: entry types, the categories a
// budget starts with, currencies and limits. Nothing here touches the
// database; src/lib/budget/server.js does that.

export const ENTRY_TYPES = [
  { key: "income", label: "Income", plural: "Income", doneLabel: "Received", undoneLabel: "Not received" },
  { key: "expense", label: "Expense", plural: "Expenses", doneLabel: "Paid", undoneLabel: "Not paid" },
  { key: "investment", label: "Investment", plural: "Investments & savings", doneLabel: "Done", undoneLabel: "Not done" },
];
export const ENTRY_TYPE_KEYS = ENTRY_TYPES.map((t) => t.key);

// Two of the types come in two kinds. An expense is a bill (rent, groceries,
// a subscription) or debt (a loan, a credit card); money put aside is an
// investment or savings. The first kind of each is the default, which is
// also what an entry from before the split is. Income has no kinds.
export const KINDS = {
  expense: [
    { key: "bill", label: "Bill", plural: "Bills", hint: "Rent, groceries, a subscription." },
    { key: "debt", label: "Debt", plural: "Debt", hint: "A loan, a credit card, money owed." },
  ],
  investment: [
    { key: "investment", label: "Investment", plural: "Investments", hint: "Stocks, funds, a pension." },
    { key: "saving", label: "Savings", plural: "Savings", hint: "A savings account, an emergency fund, a goal." },
  ],
};
export const KIND_KEYS = Object.values(KINDS).flatMap((list) => list.map((k) => k.key));

export function kindsOf(type) {
  return KINDS[type] || [];
}

/** The kind an entry of `type` is, or null for a type without kinds. */
export function kindFor(type, kind) {
  const list = kindsOf(type);
  if (!list.length) return null;
  return list.some((k) => k.key === kind) ? kind : list[0].key;
}

export function kindOf(entry) {
  return kindFor(entry.type, entry.kind);
}

export function kindMeta(type, kind) {
  return kindsOf(type).find((k) => k.key === kindFor(type, kind)) || null;
}

/** What an entry is, in one word: Income, Bill, Debt, Investment, Savings. */
export function entryLabel(entry) {
  return kindMeta(entry.type, entry.kind)?.label || entryTypeMeta(entry.type).label;
}

// The choices "what is it?" offers wherever an entry is added: a type, with
// expenses and money put aside split into their kinds.
export const ENTRY_CHOICES = [
  { key: "income", type: "income", kind: null, label: "Income" },
  { key: "bill", type: "expense", kind: "bill", label: "Bill" },
  { key: "debt", type: "expense", kind: "debt", label: "Debt" },
  { key: "investment", type: "investment", kind: "investment", label: "Investment" },
  { key: "saving", type: "investment", kind: "saving", label: "Savings" },
];

export function choiceOf(type, kind) {
  return ENTRY_CHOICES.find((c) => c.type === type && c.kind === kindFor(type, kind)) || ENTRY_CHOICES[1];
}

export function entryTypeMeta(key) {
  return ENTRY_TYPES.find((t) => t.key === key) || ENTRY_TYPES[1];
}

// Copied into a reader's settings the first time the budget opens
// (ensureSettings), so renaming or adding one never changes anyone else's.
// The "other_*" category of each type cannot be removed: entries of a removed
// category move there.
export const DEFAULT_CATEGORIES = [
  { key: "salary", label: "Salary", type: "income" },
  { key: "side_income", label: "Side income", type: "income" },
  { key: "gifts", label: "Gifts", type: "income" },
  { key: "other_income", label: "Other income", type: "income" },

  { key: "housing", label: "Housing", type: "expense" },
  { key: "utilities", label: "Utilities", type: "expense" },
  { key: "food", label: "Food", type: "expense" },
  { key: "transport", label: "Transport", type: "expense" },
  { key: "health", label: "Health", type: "expense" },
  { key: "leisure", label: "Leisure", type: "expense" },
  { key: "shopping", label: "Shopping", type: "expense" },
  { key: "subscriptions", label: "Subscriptions", type: "expense" },
  { key: "education", label: "Education", type: "expense" },
  { key: "loans", label: "Loans", type: "expense" },
  { key: "credit_card", label: "Credit card", type: "expense" },
  { key: "other_expense", label: "Other", type: "expense" },

  { key: "savings", label: "Savings account", type: "investment" },
  { key: "emergency_fund", label: "Emergency fund", type: "investment" },
  { key: "goals", label: "Goals", type: "investment" },
  { key: "stocks", label: "Stocks & ETFs", type: "investment" },
  { key: "pension", label: "Pension", type: "investment" },
  { key: "crypto", label: "Crypto", type: "investment" },
  { key: "other_investment", label: "Other", type: "investment" },
];

export const FALLBACK_CATEGORY = { income: "other_income", expense: "other_expense", investment: "other_investment" };

export function isFallbackCategory(key) {
  return Object.values(FALLBACK_CATEGORY).includes(key);
}

export function categoriesOf(categories, type) {
  return (categories || []).filter((c) => c.type === type);
}

/** The label of a category key, or the key itself for one no longer listed. */
export function categoryLabel(categories, key) {
  return (categories || []).find((c) => c.key === key)?.label || key;
}

export const BUDGET_CURRENCIES = ["EUR", "USD", "GBP", "BRL", "CHF", "CAD", "AUD", "JPY"];
export const DEFAULT_CURRENCY = "EUR";

export const BUDGET_LIMITS = {
  title: 80,
  note: 300,
  categoryLabel: 40,
  categories: 80,
  amount: 1e9,
  entriesPerMonth: 500,
  // How far ahead a repeating entry is filled in, and how far a payment can
  // be pushed back.
  monthsAhead: 24,
  maxDelay: 12,
};

/** Formats an amount in the budget's currency, e.g. "€1,234.50". */
export function formatMoney(amount, currency = DEFAULT_CURRENCY, { compact = false } = {}) {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}
