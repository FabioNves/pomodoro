// The Business rules: status, dependencies and progress. Pure functions over
// the DTOs the API returns, shared by the server (which refuses to start
// blocked work) and the browser (which recomputes everything the moment a
// work item changes, so nothing waits for a reload).
//
// Nothing here is stored. A work item keeps only "not_started", "in_progress"
// or "completed"; whether it is blocked or ready, how far a phase is, how far
// the business is and what to do next all follow from the items and the
// dependencies between them, so they can never drift.
//
//   item        { id, phase, status, weight?, order?, loop? }
//   dependency  { item, dependsOn }      "item cannot start before dependsOn is completed"
//   phase       { key, order?, weight? }

const ACTIONABLE = new Set(["in_progress", "ready", "not_started"]);

/** A usable weight: a positive number, or 1. */
function weightOf(thing) {
  const w = Number(thing?.weight);
  return Number.isFinite(w) && w > 0 ? w : 1;
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

/* ── graph ─────────────────────────────────────────────── */

/**
 * Index the items and the dependencies between them. Edges that point at an
 * item that no longer exists, or at themselves, are ignored.
 */
export function buildGraph(items = [], dependencies = []) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const prerequisites = new Map();
  const dependents = new Map();
  for (const dep of dependencies) {
    if (dep.item === dep.dependsOn || !byId.has(dep.item) || !byId.has(dep.dependsOn)) continue;
    if (!prerequisites.has(dep.item)) prerequisites.set(dep.item, []);
    if (!dependents.has(dep.dependsOn)) dependents.set(dep.dependsOn, []);
    if (prerequisites.get(dep.item).includes(dep.dependsOn)) continue;
    prerequisites.get(dep.item).push(dep.dependsOn);
    dependents.get(dep.dependsOn).push(dep.item);
  }
  return { byId, prerequisites, dependents };
}

/** The items this one waits for, done or not. */
export function prerequisitesOf(id, graph) {
  return (graph.prerequisites.get(id) || []).map((pid) => graph.byId.get(pid));
}

/** The items that wait for this one. */
export function dependentsOf(id, graph) {
  return (graph.dependents.get(id) || []).map((did) => graph.byId.get(did));
}

/** The prerequisites that are not completed: exactly what blocks the item. */
export function blockersOf(id, graph) {
  return prerequisitesOf(id, graph).filter((item) => item.status !== "completed");
}

/**
 * Where to start in order to unblock an item: the unfinished work further up
 * the chain that is not itself waiting on anything.
 */
export function rootBlockersOf(id, graph) {
  const roots = [];
  const seen = new Set([id]);
  const stack = blockersOf(id, graph);
  while (stack.length) {
    const item = stack.pop();
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const above = blockersOf(item.id, graph);
    if (above.length) stack.push(...above);
    else roots.push(item);
  }
  return roots;
}

/**
 * Would "item depends on dependsOn" close a loop? It would when dependsOn
 * already waits, directly or not, for item.
 */
export function wouldCreateCycle(itemId, dependsOnId, graph) {
  if (itemId === dependsOnId) return true;
  const seen = new Set();
  const stack = [dependsOnId];
  while (stack.length) {
    const current = stack.pop();
    if (current === itemId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(graph.prerequisites.get(current) || []));
  }
  return false;
}

/* ── status ────────────────────────────────────────────── */

/**
 * The status the screen shows for a work item:
 *   completed    it is done (and stays done even if a prerequisite is reopened)
 *   blocked      a prerequisite is not completed
 *   in_progress  started, nothing in the way
 *   ready        it had prerequisites and every one of them is completed
 *   not_started  nothing in the way, not started
 */
export function statusOf(item, graph) {
  if (item.status === "completed") return "completed";
  const prerequisites = graph.prerequisites.get(item.id) || [];
  if (prerequisites.some((pid) => graph.byId.get(pid).status !== "completed")) return "blocked";
  if (item.status === "in_progress") return "in_progress";
  return prerequisites.length ? "ready" : "not_started";
}

/** Can work happen on it right now? */
export function isActionable(status) {
  return ACTIONABLE.has(status);
}

/**
 * The status of a phase, from how many of its items are in each status:
 *   completed    every item is completed
 *   in_progress  something is under way, or some is done and more can be
 *   blocked      there is open work and none of it can move
 *   ready        nothing done yet, and a prerequisite just opened some of it
 *   not_started  nothing done yet (or no items at all)
 */
export function phaseStatusOf(counts) {
  const total = counts.completed + counts.in_progress + counts.ready + counts.blocked + counts.not_started;
  if (!total) return "not_started";
  if (counts.completed === total) return "completed";
  if (counts.in_progress > 0) return "in_progress";
  if (counts.ready + counts.not_started === 0) return "blocked";
  if (counts.completed > 0) return "in_progress";
  return counts.ready > 0 ? "ready" : "not_started";
}

/* ── progress ──────────────────────────────────────────── */

/**
 * Completed work over all work. An item in progress counts as not done:
 * five items with three completed is 60 %, whatever the other two are doing.
 * Every item weighs 1 unless it carries a `weight`.
 */
export function progressOf(items = []) {
  let total = 0;
  let done = 0;
  let weightTotal = 0;
  let weightDone = 0;
  for (const item of items) {
    const w = weightOf(item);
    total += 1;
    weightTotal += w;
    if (item.status === "completed") {
      done += 1;
      weightDone += w;
    }
  }
  const ratio = weightTotal ? weightDone / weightTotal : 0;
  return { total, done, ratio, percent: Math.round(ratio * 100) };
}

/**
 * Progress of the whole business: the average of the phases, each counting
 * by its `weight` (1 for all six today, so a plain average). A phase with no
 * work items is left out rather than counted as zero.
 */
export function overallProgressOf(phaseSummaries = []) {
  let weightTotal = 0;
  let sum = 0;
  for (const phase of phaseSummaries) {
    if (!phase.total) continue;
    const w = weightOf(phase);
    weightTotal += w;
    sum += w * phase.ratio;
  }
  const ratio = weightTotal ? sum / weightTotal : 0;
  return { ratio, percent: Math.round(ratio * 100) };
}

/* ── summary ───────────────────────────────────────────── */

const emptyCounts = () => ({ completed: 0, in_progress: 0, ready: 0, blocked: 0, not_started: 0 });

const NEXT_RANK = { in_progress: 0, ready: 1, not_started: 2 };

/**
 * Everything the screens show, from the raw snapshot.
 *
 * @returns {{
 *   graph: object,
 *   statuses: Map<string, string>,
 *   phases: object[],            one summary per phase, in order
 *   overall: { ratio: number, percent: number },
 *   counts: object,              items per status, whole business
 *   total: number, done: number, open: number,
 *   nextActions: object[],       actionable items, best first
 * }}
 */
export function summarize({ phases = [], items = [], dependencies = [] } = {}) {
  const graph = buildGraph(items, dependencies);
  const statuses = new Map(items.map((item) => [item.id, statusOf(item, graph)]));
  const orderedPhases = [...phases].sort(byOrder);
  const phaseOrder = new Map(orderedPhases.map((phase, index) => [phase.key, index]));
  const openDependents = (id) =>
    (graph.dependents.get(id) || []).filter((did) => graph.byId.get(did).status !== "completed").length;

  const counts = emptyCounts();
  for (const status of statuses.values()) counts[status] += 1;

  const phaseSummaries = orderedPhases.map((phase) => {
    const own = items.filter((item) => item.phase === phase.key).sort(byOrder);
    const phaseCounts = emptyCounts();
    for (const item of own) phaseCounts[statuses.get(item.id)] += 1;

    // What the blocked items of this phase wait for, the most wanted first.
    const waiting = new Map();
    for (const item of own) {
      if (statuses.get(item.id) !== "blocked") continue;
      for (const blocker of blockersOf(item.id, graph)) {
        const entry = waiting.get(blocker.id) || { item: blocker, blocks: 0 };
        entry.blocks += 1;
        waiting.set(blocker.id, entry);
      }
    }
    const waitingOn = [...waiting.values()].sort(
      (a, b) =>
        Number(a.item.phase === phase.key) - Number(b.item.phase === phase.key) ||
        b.blocks - a.blocks ||
        (phaseOrder.get(a.item.phase) ?? 0) - (phaseOrder.get(b.item.phase) ?? 0) ||
        byOrder(a.item, b.item),
    );

    const next =
      own.find((item) => statuses.get(item.id) === "in_progress") ||
      own.find((item) => statuses.get(item.id) === "ready") ||
      own.find((item) => statuses.get(item.id) === "not_started") ||
      null;

    return {
      ...phase,
      ...progressOf(own),
      counts: phaseCounts,
      status: phaseStatusOf(phaseCounts),
      actionable: phaseCounts.in_progress + phaseCounts.ready + phaseCounts.not_started,
      waitingOn,
      next,
    };
  });

  const nextActions = items
    .filter((item) => isActionable(statuses.get(item.id)))
    .map((item) => ({ item, status: statuses.get(item.id), unlocks: openDependents(item.id) }))
    .sort(
      (a, b) =>
        NEXT_RANK[a.status] - NEXT_RANK[b.status] ||
        (phaseOrder.get(a.item.phase) ?? 0) - (phaseOrder.get(b.item.phase) ?? 0) ||
        b.unlocks - a.unlocks ||
        byOrder(a.item, b.item),
    );

  return {
    graph,
    statuses,
    phases: phaseSummaries,
    overall: overallProgressOf(phaseSummaries),
    counts,
    total: items.length,
    done: counts.completed,
    open: items.length - counts.completed,
    nextActions,
  };
}

/* ── improvement loops ─────────────────────────────────── */

/**
 * Where each improvement loop stands: its steps in phase order, how many are
 * done, and the step it is on now (null once it has been round the cycle).
 */
export function loopSummaries(loops = [], items = [], statuses = new Map(), phases = []) {
  const phaseOrder = new Map([...phases].sort(byOrder).map((phase, index) => [phase.key, index]));
  return loops.map((loop) => {
    const steps = items
      .filter((item) => item.loop === loop.id)
      .sort((a, b) => (phaseOrder.get(a.phase) ?? 0) - (phaseOrder.get(b.phase) ?? 0) || byOrder(a, b))
      .map((item) => ({ item, status: statuses.get(item.id) || "not_started" }));
    const done = steps.filter((step) => step.status === "completed").length;
    const current = steps.find((step) => step.status !== "completed") || null;
    return { ...loop, steps, done, total: steps.length, current, finished: steps.length > 0 && done === steps.length };
  });
}
