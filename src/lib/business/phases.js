// The six phases of a business and everything else that is fixed about the
// Business feature: phase order, the areas each phase is made of, the work
// item statuses, business types and the limits. Shared with the browser, so
// nothing in here may touch the database.
//
// A phase is not a step in a wizard. All six are open at once; what holds
// work back is a specific prerequisite (a BusinessDependency between two work
// items), never the phase it happens to sit in. The order below is the flow
// the screen draws: Define → Build → Launch → Operate → Measure → Improve,
// and from Improve back to Define.

/**
 * `areas` are the modular sections of a phase workspace. `module` names the
 * future app module an area belongs to (crm, finance, projects, hr,
 * inventory, analytics), so such a module can find "its" work without the
 * phases knowing anything about it. `panels` are the extra blocks a phase
 * workspace shows besides its areas.
 */
export const PHASES = [
  {
    key: "define",
    number: 1,
    name: "Define",
    description: "Decide what the business is, who it serves and how it makes money.",
    areas: [
      { key: "identity", label: "Business identity" },
      { key: "model", label: "Business model" },
      { key: "offer", label: "Products and services" },
      { key: "customers", label: "Target customers", module: "crm" },
      { key: "pricing", label: "Pricing", module: "finance" },
      { key: "goals", label: "Goals", module: "analytics" },
      { key: "setup", label: "Initial configuration" },
    ],
    panels: [],
  },
  {
    key: "build",
    number: 2,
    name: "Build",
    description: "Put in place the processes, people and resources that deliver it.",
    areas: [
      { key: "processes", label: "Processes" },
      { key: "workflows", label: "Workflows" },
      { key: "team", label: "Team responsibilities", module: "hr" },
      { key: "products", label: "Products", module: "inventory" },
      { key: "services", label: "Services" },
      { key: "resources", label: "Resources" },
      { key: "operations", label: "Operational setup" },
    ],
    panels: [],
  },
  {
    key: "launch",
    number: 3,
    name: "Launch",
    description: "Reach customers, open the sales channels and take the first orders.",
    areas: [
      { key: "customers", label: "Customers", module: "crm" },
      { key: "channels", label: "Sales channels", module: "crm" },
      { key: "marketing", label: "Marketing", module: "crm" },
      { key: "pipeline", label: "Sales pipeline", module: "crm" },
      { key: "payments", label: "Payments", module: "finance" },
      { key: "orders", label: "Initial orders", module: "crm" },
    ],
    panels: [],
  },
  {
    key: "operate",
    number: 4,
    name: "Operate",
    description: "Run the day to day: orders, projects, money and support.",
    areas: [
      { key: "orders", label: "Orders", module: "crm" },
      { key: "projects", label: "Projects", module: "projects" },
      { key: "tasks", label: "Tasks", module: "projects" },
      { key: "inventory", label: "Inventory", module: "inventory" },
      { key: "finance", label: "Finance", module: "finance" },
      { key: "support", label: "Customer support", module: "crm" },
      { key: "team", label: "Team activity", module: "hr" },
    ],
    panels: [],
  },
  {
    key: "measure",
    number: 5,
    name: "Measure",
    description: "Track revenue, costs, customers and the numbers that show what works.",
    areas: [
      { key: "revenue", label: "Revenue", module: "finance" },
      { key: "costs", label: "Costs", module: "finance" },
      { key: "customers", label: "Customers", module: "crm" },
      { key: "conversion", label: "Conversion", module: "analytics" },
      { key: "retention", label: "Retention", module: "analytics" },
      { key: "performance", label: "Performance", module: "analytics" },
      { key: "kpis", label: "KPIs", module: "analytics" },
    ],
    panels: ["metrics"],
  },
  {
    key: "improve",
    number: 6,
    name: "Improve",
    description: "Optimise, automate and experiment, then feed what you learn back into Define.",
    areas: [
      { key: "optimization", label: "Optimization" },
      { key: "automation", label: "Automation" },
      { key: "experiments", label: "Experiments" },
      { key: "process", label: "Process improvements" },
      { key: "retention", label: "Customer retention", module: "crm" },
      { key: "opportunities", label: "New opportunities" },
    ],
    panels: ["loops"],
  },
];

export const PHASE_KEYS = PHASES.map((p) => p.key);

const phaseByKey = new Map(PHASES.map((p) => [p.key, p]));

export function phaseMeta(key) {
  return phaseByKey.get(key) || null;
}

/** "01" … "06" */
export function phaseNumber(key) {
  const meta = phaseMeta(key);
  return meta ? String(meta.number).padStart(2, "0") : "";
}

/** The phase a phase hands over to; Improve hands back to Define. */
export function nextPhaseKey(key) {
  const i = PHASE_KEYS.indexOf(key);
  return i < 0 ? null : PHASE_KEYS[(i + 1) % PHASE_KEYS.length];
}

/** The loop as the screen reads it: Measure → Improve → Define → Build → Launch → Operate. */
export const CYCLE_ORDER = ["measure", "improve", "define", "build", "launch", "operate"];

/** Area every improvement loop files its steps under, in each phase. */
export const LOOP_AREA = "Improvement loops";

/** Label of an area key within a phase; custom areas are stored by label already. */
export function areaLabel(phaseKey, areaKey) {
  const area = phaseMeta(phaseKey)?.areas.find((a) => a.key === areaKey);
  return area ? area.label : areaKey;
}

/**
 * The areas of a phase workspace, in order: the phase's own areas, then any
 * area the user made up, then the improvement loops. Only areas that hold
 * items are returned unless `withEmpty` asks for the phase's own ones too.
 */
export function areasOf(phaseKey, items = [], { withEmpty = false } = {}) {
  const known = (phaseMeta(phaseKey)?.areas || []).map((a) => a.label);
  const used = new Set(items.filter((i) => i.phase === phaseKey).map((i) => i.area));
  const custom = [...used].filter((label) => !known.includes(label) && label !== LOOP_AREA).sort();
  const ordered = [...known.filter((label) => withEmpty || used.has(label)), ...custom];
  if (used.has(LOOP_AREA)) ordered.push(LOOP_AREA);
  return ordered;
}

/* ── statuses ──────────────────────────────────────────── */

/** What is stored on a work item. */
export const STORED_STATUSES = ["not_started", "in_progress", "completed"];

/**
 * What the screen shows, for a work item and for a phase alike. "blocked" and
 * "ready" are never stored: the engine derives them from the dependencies
 * (src/lib/business/engine.js), so they can never drift.
 */
export const STATUSES = [
  { key: "not_started", label: "Not started", tone: "muted", hint: "Nothing blocks this. It has not been started." },
  { key: "in_progress", label: "In progress", tone: "primary", hint: "Work is under way." },
  { key: "blocked", label: "Blocked", tone: "warning", hint: "Waiting on a prerequisite that is not done yet." },
  { key: "ready", label: "Ready", tone: "success", hint: "Every prerequisite is done. This can start now." },
  { key: "completed", label: "Completed", tone: "done", hint: "Done." },
];

const statusByKey = new Map(STATUSES.map((s) => [s.key, s]));

export function statusMeta(key) {
  return statusByKey.get(key) || STATUSES[0];
}

/* ── business types ────────────────────────────────────── */

/**
 * What a business sells decides which work items it starts with: a service
 * business gets no inventory, a software business no stock to count.
 * `traits` are matched against a blueprint item's `needs`.
 */
export const BUSINESS_TYPES = [
  { key: "product", label: "Physical products", hint: "You make or resell goods", traits: ["products", "inventory"] },
  { key: "ecommerce", label: "Online store", hint: "You sell goods on the web", traits: ["products", "inventory"] },
  { key: "service", label: "Services", hint: "You sell your time or skills", traits: ["services"] },
  { key: "agency", label: "Agency or consulting", hint: "A team delivers client work", traits: ["services"] },
  { key: "software", label: "Software or SaaS", hint: "You sell a digital product", traits: ["products"] },
  { key: "creator", label: "Content or creator", hint: "Audience first, offers second", traits: ["products", "services"] },
  { key: "other", label: "Something else", hint: "Start with everything", traits: ["products", "services", "inventory"] },
];

export const BUSINESS_TYPE_KEYS = BUSINESS_TYPES.map((t) => t.key);

export function businessTypeMeta(key) {
  return BUSINESS_TYPES.find((t) => t.key === key) || BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
}

export const BUSINESS_CURRENCIES = ["EUR", "USD", "GBP", "BRL", "CHF", "CAD", "AUD", "JPY"];

/* ── limits ────────────────────────────────────────────── */

export const LIMITS = {
  businesses: 10,
  items: 400,
  dependenciesPerItem: 20,
  metrics: 40,
  loops: 50,
  metricHistory: 60,
  activity: 30,
  name: 120,
  description: 1000,
  title: 160,
  // A loop's title is prefixed ("Operate: ") to name its six steps.
  loopTitle: 140,
  area: 60,
  notes: 5000,
  metricLabel: 60,
};
