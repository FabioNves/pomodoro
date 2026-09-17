// Roles, plans and feature gating. Server only.
//
// Every request resolves its role here, from the database, never from
// anything the client sent:
//   admin    the configured admin email (ADMIN_EMAILS, comma separated)
//   premium  an unexpired premium plan on the User document
//   free     everyone else, signed in or not
//
// An admin may preview the app as premium or free (User.viewAs). The
// preview is applied after the real role is known and can only lower it,
// so it never grants anything; the admin routes themselves always check
// the real role (src/lib/access/admin.js).
//
// The feature registry (which plan includes what, and the global switches)
// is the AccessConfig document merged over the catalogue in
// src/lib/access/features.js. It is read on every gated request through a
// short cache, so a toggle in the admin page applies within seconds.

import { connectToDB } from "@/lib/db";
import User from "@/models/User";
import AccessConfig from "@/models/AccessConfig";
import {
  accessMap,
  denialFor,
  effectiveRole,
  featureAllowed,
  featureForPath,
  normalizeRegistry,
  VIEW_AS_ROLES,
} from "@/lib/access/features";
import { recordRequest, enterUsageContext } from "@/lib/usage/track";

const DEFAULT_ADMIN_EMAIL = "fabio367neves@outlook.com";
const REGISTRY_TTL_MS = 3000;
const USER_TTL_MS = 2000;
const ACTIVITY_THROTTLE_MS = 60000;
/** A session counts as active this long after its last request. */
export const ACTIVE_WINDOW_MS = 15 * 60 * 1000;

export function adminEmails() {
  const configured = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? configured : [DEFAULT_ADMIN_EMAIL];
}

export function isAdminEmail(email) {
  return Boolean(email) && adminEmails().includes(String(email).trim().toLowerCase());
}

/** The real role of a user document (no preview applied). */
export function roleOfUser(user) {
  if (!user) return "free";
  if (isAdminEmail(user.email)) return "admin";
  if (user.plan === "premium") {
    if (!user.planExpiresAt || new Date(user.planExpiresAt).getTime() > Date.now()) return "premium";
  }
  return "free";
}

/* ── registry ─────────────────────────────────────────── */

let registryCache = { value: null, at: 0 };

export async function loadRegistry({ fresh = false } = {}) {
  if (!fresh && registryCache.value && Date.now() - registryCache.at < REGISTRY_TTL_MS) {
    return registryCache.value;
  }
  await connectToDB();
  const stored = await AccessConfig.findOne({ key: "default" }).lean();
  const registry = normalizeRegistry(stored);
  registryCache = { value: registry, at: Date.now() };
  return registry;
}

/** Store the admin's edits; returns the normalized result. */
export async function saveRegistry({ features, plans }, { updatedBy = "" } = {}) {
  await connectToDB();
  const normalized = normalizeRegistry({ features, plans });
  await AccessConfig.findOneAndUpdate(
    { key: "default" },
    { $set: { features: normalized.features, plans: normalized.plans, updatedBy } },
    { upsert: true, new: true },
  );
  registryCache = { value: null, at: 0 };
  return loadRegistry({ fresh: true });
}

/* ── users ────────────────────────────────────────────── */

const userCache = new Map();
const activityTouched = new Map();

export function forgetUser(userId) {
  userCache.delete(String(userId));
}

export function isObjectIdString(value) {
  return /^[0-9a-fA-F]{24}$/.test(String(value || ""));
}

const USER_FIELDS =
  "email name imageUrl plan planExpiresAt viewAs lastActiveAt lastSignInAt sessionsRevokedAt createdAt";

/** Lean user record, cached for a couple of seconds per instance. */
export async function loadUser(userId) {
  const id = String(userId || "");
  if (!isObjectIdString(id)) return null;
  const hit = userCache.get(id);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.value;
  await connectToDB();
  const user = await User.findById(id).select(USER_FIELDS).lean();
  userCache.set(id, { value: user, at: Date.now() });
  return user;
}

/** Bump lastActiveAt at most once a minute per user per instance. */
export function touchActivity(userId) {
  const id = String(userId || "");
  if (!isObjectIdString(id)) return;
  const last = activityTouched.get(id) || 0;
  if (Date.now() - last < ACTIVITY_THROTTLE_MS) return;
  activityTouched.set(id, Date.now());
  connectToDB()
    .then(() => User.updateOne({ _id: id }, { $set: { lastActiveAt: new Date() } }))
    .catch((error) => console.warn("[access] could not record activity:", error?.message || error));
}

/**
 * Everything the gate needs to know about one identity.
 * @param {object|null} user lean user document, or null for an anonymous caller
 */
export async function describeAccess(user, registry) {
  const reg = registry || (await loadRegistry());
  const realRole = roleOfUser(user);
  const viewAs = realRole === "admin" && VIEW_AS_ROLES.includes(user?.viewAs) ? user.viewAs : null;
  const role = effectiveRole(realRole, viewAs);
  return { realRole, viewAs, role, registry: reg, features: accessMap(reg, role) };
}

/**
 * Check a list of features for a role. Returns null when all are allowed,
 * otherwise the 403 response for the first one that is not.
 */
export function denyIfLocked(registry, role, features) {
  const keys = (Array.isArray(features) ? features : [features]).filter(Boolean);
  for (const key of keys) {
    const feature = registry.features.find((f) => f.key === key);
    if (featureAllowed(feature, role)) continue;
    const denial = denialFor(feature);
    return Response.json({ error: denial.message, code: denial.code, feature: key }, { status: 403 });
  }
  return null;
}

function pathOf(req) {
  try {
    return new URL(req.url).pathname;
  } catch {
    return "";
  }
}

/** The features a request must be allowed to use: the explicit ones plus the one behind its path. */
export function featuresFor(req, features) {
  const keys = features === undefined || features === null ? [] : Array.isArray(features) ? [...features] : [features];
  const derived = featureForPath(pathOf(req));
  if (derived && !keys.includes(derived)) keys.push(derived);
  return keys.filter(Boolean);
}

/**
 * Gate for routes that identify the caller by the planner's identity
 * headers (user-id / session-id). The identity is not verified there, so
 * this only decides what that identity's plan includes; an anonymous
 * caller is treated as free.
 *
 * @returns {Promise<null | Response>} a 403 response when locked
 */
export async function gateIdentity(req, { userId = null, features } = {}) {
  const keys = featuresFor(req, features);
  let user = null;
  try {
    user = userId ? await loadUser(userId) : null;
  } catch (error) {
    console.warn("[access] could not load user for gating:", error?.message || error);
  }
  const access = await describeAccess(user);
  if (user) {
    touchActivity(user._id);
    enterUsageContext({ userId: String(user._id), feature: keys[0] || "other" });
  }
  recordRequest(req, user ? String(user._id) : null, { feature: keys[0] });
  return denyIfLocked(access.registry, access.role, keys);
}

/** True when this user (by id) may use the feature; used by the scheduler. */
export async function userCanUse(userId, featureKey) {
  const user = await loadUser(userId);
  const access = await describeAccess(user);
  return Boolean(access.features[featureKey]?.allowed);
}

export function isActiveNow(user, now = Date.now()) {
  return Boolean(user?.lastActiveAt) && now - new Date(user.lastActiveAt).getTime() < ACTIVE_WINDOW_MS;
}

/** What the admin routes answer to anyone who is not the admin. */
export function notFoundResponse() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

/** The shape /api/me returns and the browser's AccessProvider stores. */
export function meDto(auth) {
  const { user, realRole, role, viewAs, features, registry } = auth;
  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl || null,
    },
    realRole,
    role,
    viewAs,
    plan: {
      key: user.plan || "free",
      expiresAt: user.planExpiresAt || null,
    },
    features,
    registry: {
      features: registry.features.map((f) => ({
        key: f.key,
        name: f.name,
        description: f.description,
        group: f.group,
        availableToFree: f.availableToFree,
        availableToPremium: f.availableToPremium,
        enabled: f.enabled,
      })),
      plans: registry.plans,
    },
  };
}
