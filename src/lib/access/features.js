// Feature registry: the single source of truth for what each plan can do.
// Shared with the browser (the pricing page and the gating helpers use it),
// so nothing in here may touch the database or the environment.
//
// The catalogue below lists every gateable feature with its defaults. The
// admin's edits are stored in the AccessConfig document and merged over the
// catalogue by normalizeRegistry(): a feature added here shows up in the
// admin table, the pricing page and the runtime gate without a migration.

export const ROLES = ["admin", "premium", "free"];
export const PLAN_KEYS = ["free", "premium"];
export const PLAN_STATUSES = ["available", "coming_soon", "hidden"];
export const BILLING_INTERVALS = ["month", "year"];
export const CURRENCIES = ["EUR", "USD", "GBP"];
export const VIEW_AS_ROLES = ["premium", "free"];

/**
 * Every feature the app can gate, with the plan it belongs to by default.
 * `group` only orders the tables and the pricing columns.
 */
export const FEATURE_CATALOGUE = [
  {
    key: "timer",
    name: "Pomodoro timer",
    description: "Focus and break sessions, projects and the session history.",
    group: "Core",
    availableToFree: true,
    availableToPremium: true,
    enabled: true,
  },
  {
    key: "planner",
    name: "Planner",
    description: "Projects, milestones, tasks, the week plan and the calendar.",
    group: "Core",
    availableToFree: true,
    availableToPremium: true,
    enabled: true,
  },
  {
    key: "habits",
    name: "Habit tracker",
    description: "Daily habits with streaks and the habit grid.",
    group: "Core",
    availableToFree: true,
    availableToPremium: true,
    enabled: true,
  },
  {
    key: "routines",
    name: "Cycles",
    description: "Recurring tasks that repeat on a schedule and fill your week automatically.",
    group: "Core",
    availableToFree: true,
    availableToPremium: true,
    enabled: true,
  },
  {
    key: "notebook",
    name: "Notebook",
    description: "Notes with tabs, folders, saved views, quotes and the Brain graph.",
    group: "Core",
    availableToFree: true,
    availableToPremium: true,
    enabled: true,
  },
  {
    // In no plan, so admin only (see isAdminOnly): tick a plan under
    // Admin > Subscriptions to open it up.
    key: "business",
    name: "Business",
    description: "Six connected phases for creating, running and improving a business, with progress and dependencies.",
    group: "Core",
    availableToFree: false,
    availableToPremium: false,
    enabled: true,
  },
  {
    key: "analytics",
    name: "Analytics",
    description: "Weekly, monthly and yearly focus statistics.",
    group: "Core",
    availableToFree: true,
    availableToPremium: true,
    enabled: true,
  },
  {
    key: "news_briefing",
    name: "AI news briefing",
    description: "Daily, weekly and monthly briefings built from real sources, with regional editions.",
    group: "AI",
    availableToFree: false,
    availableToPremium: true,
    enabled: true,
  },
  {
    key: "news_ask",
    name: "Ask about a story",
    description: "Follow-up questions on any briefing story, answered from its sources.",
    group: "AI",
    availableToFree: false,
    availableToPremium: true,
    enabled: true,
  },
  {
    key: "ai_project_planning",
    name: "AI project planning",
    description: "Suggested milestones, tasks and whole project structures.",
    group: "AI",
    availableToFree: false,
    availableToPremium: true,
    enabled: true,
  },
  {
    key: "ai_quotes",
    name: "AI quote finder",
    description: "Quotes by an author, found and verified on the web.",
    group: "AI",
    availableToFree: false,
    availableToPremium: true,
    enabled: true,
  },
  {
    key: "ai_voice",
    name: "AI voice",
    description: "Your quotes read aloud by a natural AI voice in the quote player.",
    group: "AI",
    availableToFree: false,
    availableToPremium: true,
    enabled: true,
  },
];

export const DEFAULT_PLANS = {
  free: {
    key: "free",
    name: "Free",
    tagline: "Everything you need to focus.",
    price: 0,
    currency: "EUR",
    interval: "month",
    status: "available",
    checkoutUrl: "",
  },
  premium: {
    key: "premium",
    name: "Premium",
    tagline: "Adds the AI features.",
    price: 4.99,
    currency: "EUR",
    interval: "month",
    status: "coming_soon",
    checkoutUrl: "",
  },
};

export const FEATURE_KEYS = FEATURE_CATALOGUE.map((f) => f.key);

const catalogueByKey = new Map(FEATURE_CATALOGUE.map((f) => [f.key, f]));

export function featureMeta(key) {
  return catalogueByKey.get(key) || null;
}

function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function text(value, fallback, max = 300) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

function money(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
}

/**
 * Merge whatever is stored over the catalogue and the default plans. Unknown
 * feature keys are dropped; missing ones get their defaults. The result is
 * what every consumer (gate, admin table, pricing page) works with.
 */
export function normalizeRegistry(stored) {
  const storedFeatures = new Map(
    (Array.isArray(stored?.features) ? stored.features : []).map((f) => [f?.key, f]),
  );
  const features = FEATURE_CATALOGUE.map((base) => {
    const s = storedFeatures.get(base.key) || {};
    return {
      key: base.key,
      group: base.group,
      name: text(s.name, base.name, 80),
      description: text(s.description, base.description, 300),
      availableToFree: bool(s.availableToFree, base.availableToFree),
      availableToPremium: bool(s.availableToPremium, base.availableToPremium),
      enabled: bool(s.enabled, base.enabled),
    };
  });

  const plans = {};
  for (const key of PLAN_KEYS) {
    const base = DEFAULT_PLANS[key];
    const s = stored?.plans?.[key] || {};
    plans[key] = {
      key,
      name: text(s.name, base.name, 40),
      tagline: text(s.tagline, base.tagline, 120),
      price: money(s.price, base.price),
      currency: CURRENCIES.includes(s.currency) ? s.currency : base.currency,
      interval: BILLING_INTERVALS.includes(s.interval) ? s.interval : base.interval,
      status: PLAN_STATUSES.includes(s.status) ? s.status : base.status,
      checkoutUrl: /^https:\/\//i.test(s.checkoutUrl || "") ? String(s.checkoutUrl).slice(0, 500) : "",
    };
  }
  return { features, plans, updatedAt: stored?.updatedAt || null };
}

export const DEFAULT_REGISTRY = normalizeRegistry(null);

/** "admin" | "premium" | "free" once a preview is applied. Previews only lower. */
export function effectiveRole(realRole, viewAs) {
  if (realRole !== "admin") return realRole;
  return VIEW_AS_ROLES.includes(viewAs) ? viewAs : "admin";
}

/** Can this role use the feature? Admins can use anything that is enabled. */
export function featureAllowed(feature, role) {
  if (!feature || !feature.enabled) return false;
  if (role === "admin") return true;
  if (role === "premium") return feature.availableToPremium;
  return feature.availableToFree;
}

/**
 * Enabled but in no plan: only the admin has it. Everyone else is not told
 * it exists (no menu entry, no pricing row, the app's 404), rather than
 * offered an upgrade to a plan that does not include it either.
 */
export function isAdminOnly(feature) {
  return Boolean(feature && feature.enabled && !feature.availableToFree && !feature.availableToPremium);
}

/**
 * Per-feature verdicts for one role:
 *   allowed   - the role can use it now
 *   enabled   - the global switch is on
 *   locked    - enabled but not included in this role's plan (show the upsell)
 *   hidden    - admin only, and this role is not the admin (show nothing)
 *   adminOnly - in no plan, whoever is asking
 */
export function accessMap(registry, role) {
  const map = {};
  for (const f of registry.features) {
    const allowed = featureAllowed(f, role);
    const adminOnly = isAdminOnly(f);
    const hidden = adminOnly && !allowed;
    map[f.key] = { allowed, enabled: f.enabled, locked: f.enabled && !allowed && !hidden, hidden, adminOnly };
  }
  return map;
}

/** Why a feature cannot be used, for the server's 403 body and the UI. */
export function denialFor(feature) {
  if (!feature) return { code: "feature_unknown", message: "Unknown feature." };
  if (!feature.enabled) {
    return { code: "feature_disabled", message: `${feature.name} is currently unavailable.` };
  }
  return { code: "feature_locked", message: `${feature.name} is available on Premium.` };
}

/** The feature behind an API path, for gating and usage tracking. */
export function featureForPath(pathname = "") {
  const p = String(pathname);
  if (/^\/api\/sessions\/(week|month|year)\b/.test(p)) return "analytics";
  if (/^\/api\/(sessions|brands|milestones)\b/.test(p)) return "timer";
  if (/^\/api\/(projects|project-milestones|tasks|week-plans)\b/.test(p)) return "planner";
  if (/^\/api\/habits\b/.test(p)) return "habits";
  if (/^\/api\/routine-tasks\b/.test(p)) return "routines";
  if (/^\/api\/notebook\b/.test(p)) return "notebook";
  if (/^\/api\/business\b/.test(p)) return "business";
  if (/^\/api\/news\b/.test(p)) return "news_briefing";
  return null;
}

export function formatPrice(plan) {
  const symbols = { EUR: "€", USD: "$", GBP: "£" };
  const symbol = symbols[plan.currency] || `${plan.currency} `;
  const amount = Number.isInteger(plan.price) ? String(plan.price) : plan.price.toFixed(2);
  return `${symbol}${amount}`;
}
