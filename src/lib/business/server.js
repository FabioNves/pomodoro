// Server-side helpers for the Business API: validation, DTOs, ownership
// checks, the snapshot every screen is drawn from, the structure a new
// business starts with, and the activity log. Server only: it imports the
// models. phases.js, blueprint.js, engine.js and metrics.js are shared with
// the browser.

import { z } from "zod";
import Business from "@/models/Business";
import BusinessPhase from "@/models/BusinessPhase";
import BusinessWorkItem from "@/models/BusinessWorkItem";
import BusinessDependency from "@/models/BusinessDependency";
import BusinessMetric from "@/models/BusinessMetric";
import BusinessActivity from "@/models/BusinessActivity";
import { PHASES, PHASE_KEYS, BUSINESS_TYPE_KEYS, BUSINESS_CURRENCIES, LIMITS } from "./phases";
import { blueprintFor } from "./blueprint";
import { DEFAULT_METRICS } from "./metrics";
import { buildGraph, blockersOf } from "./engine";

export const SIGN_IN = { signInMessage: "Sign in to use Business.", feature: "business" };

/* ── validation ────────────────────────────────────────── */

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
export const phaseKey = z.enum(PHASE_KEYS);
export const businessName = z.string().trim().min(1, "Give the business a name").max(LIMITS.name);
export const businessType = z.enum(BUSINESS_TYPE_KEYS);
export const businessCurrency = z.enum(BUSINESS_CURRENCIES);
export const descriptionText = z.string().trim().max(LIMITS.description);
export const itemTitle = z.string().trim().min(1, "Give the work item a title").max(LIMITS.title);
export const areaName = z.string().trim().min(1, "Choose an area").max(LIMITS.area);

/** Throwable error that `run()` turns into a JSON response. `extra` is merged into the body. */
export function apiError(status, message, extra = null) {
  const error = new Error(message);
  error.status = status;
  error.extra = extra;
  return error;
}

/** Runs a route body, mapping apiError() to its status and anything else to 500. */
export async function run(label, fn) {
  try {
    return await fn();
  } catch (error) {
    if (error?.status && error.status < 500) {
      return Response.json({ error: error.message, ...(error.extra || {}) }, { status: error.status });
    }
    console.error(`[business] ${label} failed`, error);
    return Response.json({ error: "Something went wrong in Business." }, { status: 500 });
  }
}

/* ── DTOs ──────────────────────────────────────────────── */

const idOrNull = (value) => (value ? String(value) : null);

export function businessDto(business) {
  return {
    id: String(business._id),
    name: business.name,
    type: business.type || "other",
    description: business.description || "",
    currency: business.currency || "EUR",
    cycle: business.cycle || 1,
    loops: (business.loops || []).map((loop) => ({
      id: String(loop._id),
      title: loop.title,
      number: loop.number,
      origin: idOrNull(loop.origin),
      createdAt: loop.createdAt,
    })),
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  };
}

export function phaseDto(phase) {
  return {
    id: String(phase._id),
    key: phase.key,
    order: phase.order ?? 0,
    name: phase.name,
    description: phase.description || "",
    weight: phase.weight ?? 1,
  };
}

export function itemDto(item) {
  return {
    id: String(item._id),
    phase: item.phaseKey,
    phaseId: String(item.phase),
    area: item.area,
    title: item.title,
    description: item.description || "",
    notes: item.notes || "",
    status: item.status,
    order: item.order ?? 0,
    weight: item.weight ?? 1,
    templateKey: item.templateKey || null,
    loop: idOrNull(item.loop),
    link: item.link?.href ? { label: item.link.label || "Open", href: item.link.href } : null,
    startedAt: item.startedAt || null,
    completedAt: item.completedAt || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function dependencyDto(dep) {
  return { id: String(dep._id), item: String(dep.item), dependsOn: String(dep.dependsOn) };
}

export function metricDto(metric) {
  return {
    id: String(metric._id),
    key: metric.key,
    label: metric.label,
    kind: metric.kind,
    hint: metric.hint || "",
    value: metric.value ?? null,
    target: metric.target ?? null,
    pinned: !!metric.pinned,
    order: metric.order ?? 0,
    source: metric.source || "manual",
    history: (metric.history || []).slice(-12).map((h) => ({ value: h.value, at: h.at })),
    updatedAt: metric.updatedAt,
  };
}

export function activityDto(row) {
  return {
    id: String(row._id),
    type: row.type,
    title: row.title,
    phase: row.phaseKey || null,
    item: idOrNull(row.item),
    at: row.createdAt,
  };
}

/* ── ownership ─────────────────────────────────────────── */

/** The business with this id, which must belong to the user. */
export async function assertBusiness(userId, businessId) {
  const business = await Business.findOne({ _id: businessId, user: userId });
  if (!business) throw apiError(404, "Business not found");
  return business;
}

/** The work item with this id, which must belong to the user. */
export async function assertItem(userId, itemId) {
  const item = await BusinessWorkItem.findOne({ _id: itemId, user: userId });
  if (!item) throw apiError(404, "Work item not found");
  return item;
}

/* ── snapshot ──────────────────────────────────────────── */

/**
 * Everything the Business screens are drawn from, in one reply: the user's
 * businesses (for the switcher) and, for the one being shown, its phases,
 * work items, dependencies, metrics and recent activity. An unknown
 * `businessId` falls back to the first business rather than failing, so a
 * link to a deleted business still opens the page.
 */
export async function loadSnapshot(userId, businessId = null) {
  const all = await Business.find({ user: userId }).sort({ createdAt: 1 });
  const businesses = all.map((b) => ({ id: String(b._id), name: b.name }));
  const business = all.find((b) => String(b._id) === businessId) || all[0] || null;
  if (!business) {
    return { businesses, business: null, phases: [], items: [], dependencies: [], metrics: [], activity: [] };
  }
  const scope = { business: business._id, user: userId };
  const [phases, items, dependencies, metrics, activity] = await Promise.all([
    BusinessPhase.find(scope).sort({ order: 1 }),
    BusinessWorkItem.find(scope).sort({ phaseKey: 1, order: 1, createdAt: 1 }),
    BusinessDependency.find(scope),
    BusinessMetric.find(scope).sort({ order: 1, createdAt: 1 }),
    BusinessActivity.find(scope).sort({ createdAt: -1 }).limit(LIMITS.activity),
  ]);
  return {
    businesses,
    business: businessDto(business),
    phases: phases.map(phaseDto),
    items: items.map(itemDto),
    dependencies: dependencies.map(dependencyDto),
    metrics: metrics.map(metricDto),
    activity: activity.map(activityDto),
  };
}

/* ── structure ─────────────────────────────────────────── */

/**
 * Gives a new business its six phases, the work items its type starts with,
 * the prerequisites between them and the default metrics.
 */
export async function seedBusiness(business) {
  const base = { user: business.user, business: business._id };
  const phases = await BusinessPhase.insertMany(
    PHASES.map((phase, order) => ({
      ...base,
      key: phase.key,
      order,
      name: phase.name,
      description: phase.description,
    })),
  );
  const phaseIdByKey = new Map(phases.map((phase) => [phase.key, phase._id]));

  const { items, dependencies } = blueprintFor(business.type);
  const now = new Date();
  const created = await BusinessWorkItem.insertMany(
    items.map((item) => ({
      ...base,
      phase: phaseIdByKey.get(item.phase),
      phaseKey: item.phase,
      area: item.area,
      title: item.title,
      description: item.description,
      status: item.status,
      order: item.order,
      templateKey: item.key,
      link: item.link,
      startedAt: item.status === "completed" ? now : null,
      completedAt: item.status === "completed" ? now : null,
    })),
  );
  const itemIdByKey = new Map(created.map((item) => [item.templateKey, item._id]));

  await BusinessDependency.insertMany(
    dependencies.map((dep) => ({
      ...base,
      item: itemIdByKey.get(dep.item),
      dependsOn: itemIdByKey.get(dep.dependsOn),
    })),
  );
  await BusinessMetric.insertMany(
    DEFAULT_METRICS.map((metric, order) => ({
      ...base,
      key: metric.key,
      label: metric.label,
      kind: metric.kind,
      hint: metric.hint,
      pinned: metric.pinned,
      order,
    })),
  );
}

/** Removes a business and everything under it. */
export async function deleteBusinessData(businessId) {
  const scope = { business: businessId };
  await Promise.all([
    BusinessPhase.deleteMany(scope),
    BusinessWorkItem.deleteMany(scope),
    BusinessDependency.deleteMany(scope),
    BusinessMetric.deleteMany(scope),
    BusinessActivity.deleteMany(scope),
  ]);
  await Business.deleteOne({ _id: businessId });
}

/* ── work items ────────────────────────────────────────── */

/** The unfinished prerequisites of a work item, straight from the database. */
export async function blockersFor(item) {
  const edges = await BusinessDependency.find({ item: item._id }).select("item dependsOn");
  if (!edges.length) return [];
  const prerequisites = await BusinessWorkItem.find({
    _id: { $in: edges.map((edge) => edge.dependsOn) },
    business: item.business,
  }).select("title status phaseKey");
  const graph = buildGraph(
    [{ id: String(item._id), status: item.status }, ...prerequisites.map((p) => ({ id: String(p._id), status: p.status, title: p.title, phase: p.phaseKey }))],
    edges.map((edge) => ({ item: String(edge.item), dependsOn: String(edge.dependsOn) })),
  );
  return blockersOf(String(item._id), graph).map((blocker) => ({
    id: blocker.id,
    title: blocker.title,
    phase: blocker.phase,
  }));
}

/** Where a new item goes: after the last one in its phase. */
export async function nextOrder(businessId, phase) {
  const last = await BusinessWorkItem.findOne({ business: businessId, phaseKey: phase }).sort({ order: -1 }).select("order");
  return last ? (last.order ?? 0) + 1 : 0;
}

/* ── activity ──────────────────────────────────────────── */

/**
 * Appends to the activity log and returns the new rows as DTOs, so the
 * route can hand them to the browser with its reply. A log that fails to
 * write must never fail the change it describes.
 *
 * @param {object} business the Business document
 * @param {{ type: string, title: string, phaseKey?: string, item?: any }[]} entries
 */
export async function logActivity(business, entries) {
  try {
    const rows = await BusinessActivity.insertMany(
      entries.map((entry) => ({
        user: business.user,
        business: business._id,
        type: entry.type,
        title: String(entry.title).slice(0, 300),
        phaseKey: entry.phaseKey || null,
        item: entry.item || null,
      })),
    );
    return rows.map(activityDto).reverse();
  } catch (error) {
    console.warn("[business] could not write the activity log:", error?.message || error);
    return [];
  }
}
