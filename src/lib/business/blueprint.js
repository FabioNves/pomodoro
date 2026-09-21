// What a new business starts with: the work items of each phase and the
// prerequisites between them. This is data, like src/lib/projectTemplates.js:
// the server copies it into BusinessWorkItem and BusinessDependency documents
// when a business is created, and from then on the user's own data is the
// truth (rename, remove, add, rewire anything). Shared with the browser.
//
// `key` is `<phase>.<slug>` and only serves to wire `dependsOn` here; the
// stored item keeps it as `templateKey`. `area` is an area key of the phase
// (see phases.js). `needs` limits an item to business types that have the
// trait. `link` points at a screen of the app that already does the work.
//
// Prerequisites name a specific item, never a whole phase, so later phases
// open up piece by piece while earlier ones are still being refined.

import { PHASES, businessTypeMeta, areaLabel, LOOP_AREA } from "./phases";

export const BLUEPRINT = [
  /* ── Define ──────────────────────────────────────────── */
  {
    key: "define.identity",
    area: "identity",
    title: "Create the business profile",
    description: "The name, what the business does and the kind of business it is.",
    dependsOn: [],
    // Creating the business is this item: it starts completed.
    doneOnCreate: true,
  },
  {
    key: "define.model",
    area: "model",
    title: "Choose the business model",
    description: "How the business makes money: what you sell, to whom, and how you get paid for it.",
    dependsOn: ["define.identity"],
  },
  {
    key: "define.offer",
    area: "offer",
    title: "List your products and services",
    description: "Everything you will sell, one sentence each. Start with the one you would sell tomorrow.",
    dependsOn: ["define.identity"],
  },
  {
    key: "define.customers",
    area: "customers",
    title: "Describe your target customers",
    description: "Who buys, which problem they want solved, and where you can reach them.",
    dependsOn: ["define.identity"],
  },
  {
    key: "define.pricing",
    area: "pricing",
    title: "Set your pricing",
    description: "A price for each product or service, and what it is based on: cost, value or the market.",
    dependsOn: ["define.offer", "define.customers"],
  },
  {
    key: "define.goals",
    area: "goals",
    title: "Set goals for the first year",
    description: "What success looks like, with numbers and dates: revenue, customers, or whatever matters to you.",
    dependsOn: ["define.model"],
  },
  {
    key: "define.setup",
    area: "setup",
    title: "Complete the initial configuration",
    description: "Legal form, registration, bank account and tax setup: what the business needs in order to exist.",
    dependsOn: ["define.identity"],
  },

  /* ── Build ───────────────────────────────────────────── */
  {
    key: "build.processes",
    area: "processes",
    title: "Map the core processes",
    description: "How an order moves from the first request to delivery, step by step.",
    dependsOn: ["define.offer"],
  },
  {
    key: "build.workflows",
    area: "workflows",
    title: "Set up the day-to-day workflows",
    description: "Turn each process into a checklist, a template or a tool, so it runs the same way every time.",
    dependsOn: ["build.processes"],
  },
  {
    key: "build.team",
    area: "team",
    title: "Assign team responsibilities",
    description: "Who owns sales, delivery, support and money, even when it is all you.",
    dependsOn: ["define.model"],
  },
  {
    key: "build.products",
    area: "products",
    title: "Get the products ready to sell",
    description: "Each product sourced or built, described, photographed and priced.",
    dependsOn: ["define.offer", "define.pricing"],
    needs: "products",
  },
  {
    key: "build.services",
    area: "services",
    title: "Package your services",
    description: "Scope, deliverables, duration and price for each service you offer.",
    dependsOn: ["define.offer", "define.pricing"],
    needs: "services",
  },
  {
    key: "build.resources",
    area: "resources",
    title: "Line up the resources",
    description: "The tools, suppliers, equipment and budget you need before the first customer arrives.",
    dependsOn: ["define.identity"],
  },
  {
    key: "build.operations",
    area: "operations",
    title: "Finish the operational setup",
    description: "Accounts, software and workspace in place and tested.",
    dependsOn: ["define.setup"],
  },

  /* ── Launch ──────────────────────────────────────────── */
  {
    key: "launch.customers",
    area: "customers",
    title: "Create your first customer list",
    description: "The first people or companies you will approach, by name.",
    dependsOn: ["define.customers"],
  },
  {
    key: "launch.channels",
    area: "channels",
    title: "Choose your sales channels",
    description: "Where customers will buy: your own site, a marketplace, direct sales, partners.",
    dependsOn: ["define.customers", "define.offer"],
  },
  {
    key: "launch.marketing",
    area: "marketing",
    title: "Prepare the launch marketing",
    description: "The message, the materials and where you will publish them.",
    dependsOn: ["launch.channels"],
  },
  {
    key: "launch.pipeline",
    area: "pipeline",
    title: "Set up the sales pipeline",
    description: "The stages a lead goes through, from first contact to paid.",
    dependsOn: ["launch.customers"],
  },
  {
    key: "launch.payments",
    area: "payments",
    title: "Configure a payment method",
    description: "How customers pay you: card, bank transfer or invoice.",
    dependsOn: ["define.setup"],
  },
  {
    key: "launch.sales",
    area: "orders",
    title: "Launch sales",
    description: "Open for business: the offer is live and customers can buy.",
    dependsOn: ["define.identity", "build.products", "build.services", "define.pricing", "launch.payments"],
  },
  {
    key: "launch.first_orders",
    area: "orders",
    title: "Win the first orders",
    description: "The first paying customers, however small the order.",
    dependsOn: ["launch.sales", "launch.marketing"],
  },

  /* ── Operate ─────────────────────────────────────────── */
  {
    key: "operate.orders",
    area: "orders",
    title: "Track every order from paid to delivered",
    description: "One place that shows each open order and what happens to it next.",
    dependsOn: ["launch.first_orders", "build.workflows"],
  },
  {
    key: "operate.projects",
    area: "projects",
    title: "Organise the work into projects",
    description: "Client and internal work, each with its milestones and an owner.",
    dependsOn: ["build.processes"],
    link: { label: "Open the Planner", href: "/planner?tab=tasks" },
  },
  {
    key: "operate.tasks",
    area: "tasks",
    title: "Set a weekly operating routine",
    description: "The recurring tasks that keep the business running, on the days they happen.",
    dependsOn: ["build.team"],
    link: { label: "Open Cycles", href: "/planner?tab=routines&view=cycles" },
  },
  {
    key: "operate.inventory",
    area: "inventory",
    title: "Keep stock levels under control",
    description: "What is in stock, what is running low and when to reorder.",
    dependsOn: ["build.products"],
    needs: "inventory",
  },
  {
    key: "operate.finance",
    area: "finance",
    title: "Put bookkeeping and invoicing in place",
    description: "Every sale invoiced, every cost recorded, and the books up to date each month.",
    dependsOn: ["launch.payments"],
  },
  {
    key: "operate.support",
    area: "support",
    title: "Open a customer support channel",
    description: "One clear way for customers to reach you, and a time within which you answer.",
    dependsOn: ["launch.channels"],
  },
  {
    key: "operate.team",
    area: "team",
    title: "Hold a regular team check-in",
    description: "A fixed moment to look at what was done, what is stuck and what comes next.",
    dependsOn: ["build.team"],
  },

  /* ── Measure ─────────────────────────────────────────── */
  {
    key: "measure.revenue",
    area: "revenue",
    title: "Record revenue every month",
    description: "What came in, by product or service. Keep the Revenue figure in Business health current.",
    dependsOn: ["operate.finance"],
  },
  {
    key: "measure.costs",
    area: "costs",
    title: "Record costs every month",
    description: "What went out, fixed and variable, so the margin is never a guess.",
    dependsOn: ["operate.finance"],
  },
  {
    key: "measure.customers",
    area: "customers",
    title: "Count your active customers",
    description: "How many customers you have, how many are new and how many left.",
    dependsOn: ["launch.first_orders"],
  },
  {
    key: "measure.conversion",
    area: "conversion",
    title: "Measure conversion through the pipeline",
    description: "Of the people who hear about you, how many become leads, and how many leads pay.",
    dependsOn: ["launch.pipeline"],
  },
  {
    key: "measure.retention",
    area: "retention",
    title: "Measure customer retention",
    description: "How many customers buy again or stay subscribed.",
    dependsOn: ["measure.customers"],
  },
  {
    key: "measure.performance",
    area: "performance",
    title: "Review performance against your goals",
    description: "Compare the numbers with the goals you set in Define, every month.",
    dependsOn: ["define.goals", "measure.revenue"],
  },
  {
    key: "measure.kpis",
    area: "kpis",
    title: "Pick the KPIs that matter",
    description: "The three to five numbers you look at every week. Add them to Business health.",
    dependsOn: ["define.goals"],
  },

  /* ── Improve ─────────────────────────────────────────── */
  {
    key: "improve.optimization",
    area: "optimization",
    title: "Find the biggest bottleneck",
    description: "The one thing that limits growth the most right now.",
    dependsOn: ["measure.performance"],
  },
  {
    key: "improve.automation",
    area: "automation",
    title: "Automate one repetitive task",
    description: "Pick the task you repeat most often and let a tool do it.",
    dependsOn: ["build.workflows"],
  },
  {
    key: "improve.experiments",
    area: "experiments",
    title: "Run one experiment",
    description: "One change, one number it should move, and a date to check it.",
    dependsOn: ["measure.kpis"],
  },
  {
    key: "improve.process",
    area: "process",
    title: "Improve one process",
    description: "Take the process that causes the most rework and make it simpler.",
    dependsOn: ["operate.orders"],
  },
  {
    key: "improve.retention",
    area: "retention",
    title: "Launch a customer retention action",
    description: "One thing that gives existing customers a reason to come back.",
    dependsOn: ["measure.retention"],
  },
  {
    key: "improve.opportunities",
    area: "opportunities",
    title: "Keep a list of new opportunities",
    description: "Ideas for products, markets and partnerships. Each one can become an improvement loop.",
    dependsOn: [],
  },
];

/**
 * The work items and dependency pairs a business of this type starts with.
 * Items the type has no use for are left out, and so are the prerequisites
 * that pointed at them.
 *
 * @returns {{ items: { key, phase, area, title, description, order, status, link }[],
 *   dependencies: { item: string, dependsOn: string }[] }}
 */
export function blueprintFor(typeKey) {
  const traits = new Set(businessTypeMeta(typeKey).traits);
  const kept = BLUEPRINT.filter((entry) => !entry.needs || traits.has(entry.needs));
  const keys = new Set(kept.map((entry) => entry.key));
  const orderInPhase = new Map();

  const items = kept.map((entry) => {
    const phase = entry.key.split(".")[0];
    const order = orderInPhase.get(phase) || 0;
    orderInPhase.set(phase, order + 1);
    return {
      key: entry.key,
      phase,
      area: areaLabel(phase, entry.area),
      title: entry.title,
      description: entry.description,
      order,
      status: entry.doneOnCreate ? "completed" : "not_started",
      link: entry.link || null,
    };
  });

  const dependencies = kept.flatMap((entry) =>
    entry.dependsOn.filter((key) => keys.has(key)).map((key) => ({ item: entry.key, dependsOn: key })),
  );

  return { items, dependencies };
}

/* ── improvement loops ─────────────────────────────────── */

const LOOP_STEPS = {
  define: { verb: "Define", description: "Decide what changes and what success will look like." },
  build: { verb: "Build", description: "Make the change real: update the offer, the process or the tooling." },
  launch: { verb: "Launch", description: "Roll it out to customers." },
  operate: { verb: "Operate", description: "Run it as part of normal operations." },
  measure: { verb: "Measure", description: "Compare the numbers before and after." },
  improve: { verb: "Review", description: "Keep it, adjust it or drop it, and decide what the next loop is." },
};

/**
 * One pass round the cycle for a single improvement: a step in every phase,
 * each waiting on the one before it, from Define through to Improve.
 */
export function loopSteps(title) {
  return PHASES.map((phase) => ({
    phase: phase.key,
    area: LOOP_AREA,
    title: `${LOOP_STEPS[phase.key].verb}: ${title}`,
    description: LOOP_STEPS[phase.key].description,
  }));
}
