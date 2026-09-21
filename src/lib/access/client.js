"use client";

// Browser side of roles and feature gating.
//
// AccessProvider (mounted once in the root layout) loads /api/me for the
// signed-in user: their real role, the preview role an admin may have
// chosen, and what the feature registry lets that role use. Components ask
// useAccess() and render locked controls accordingly. This only decides
// what to draw: every API route makes the same decision on its own.
//
// The last answer is kept in localStorage so a reload paints the right
// state at once instead of flashing unlocked controls.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearSession } from "@/lib/auth";
import { featureMeta, isAdminOnly } from "@/lib/access/features";

const AccessContext = createContext(null);
const SNAPSHOT_KEY = "accessSnapshot";

/**
 * Hidden (admin only, and not the admin)? Before /api/me has an answer for
 * the feature (signed out, first paint, a snapshot older than the feature)
 * the catalogue default decides, so an admin-only tab never flashes up for
 * everyone else.
 */
function hiddenIn(features, known, key) {
  const verdict = known ? features[key] : null;
  return verdict ? Boolean(verdict.hidden) : isAdminOnly(featureMeta(key));
}

/** Fetch helper for the account routes: Bearer session token, JSON in and out. */
export async function accessApi(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    const userId = localStorage.getItem("userId");
    if (token) headers.Authorization = `Bearer ${token}`;
    if (userId) headers["user-id"] = userId;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.code = data?.code || null;
    error.feature = data?.feature || null;
    throw error;
  }
  return data;
}

function readSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A snapshot only belongs to the session that produced it.
    if (parsed?.user?.id && parsed.user.id !== localStorage.getItem("userId")) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(me) {
  try {
    if (me) localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(me));
    else localStorage.removeItem(SNAPSHOT_KEY);
  } catch {}
}

export function AccessProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      writeSnapshot(null);
      setMe(null);
      setSignedIn(false);
      setLoading(false);
      return null;
    }
    setSignedIn(true);
    try {
      const data = await accessApi("/api/me");
      writeSnapshot(data);
      setMe(data);
      return data;
    } catch (error) {
      if (error.status === 401) {
        // Expired, or signed out from the admin page: drop the session so
        // every page sends the user back to sign in.
        clearSession();
        writeSnapshot(null);
        setMe(null);
        setSignedIn(false);
        if (error.code === "session_revoked") window.location.replace("/");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const snapshot = readSnapshot();
    if (snapshot && localStorage.getItem("accessToken")) {
      setMe(snapshot);
      setSignedIn(true);
    }
    refresh();
  }, [refresh]);

  const setViewAs = useCallback(async (viewAs) => {
    const data = await accessApi("/api/me/view-as", { method: "PUT", body: { viewAs: viewAs || null } });
    writeSnapshot(data);
    setMe(data);
    // Every page reads its data on mount; a reload is the one sure way to
    // make the whole app behave as the chosen role.
    window.location.reload();
  }, []);

  const value = useMemo(() => {
    const features = me?.features || {};
    const realRole = me?.realRole || "free";
    const role = me?.role || "free";
    return {
      loading,
      signedIn,
      me,
      user: me?.user || null,
      realRole,
      role,
      viewAs: me?.viewAs || null,
      isAdmin: realRole === "admin",
      previewing: Boolean(me?.viewAs),
      plan: me?.plan || { key: "free", expiresAt: null },
      registry: me?.registry || null,
      features,
      /** Whether the control for a feature is usable. Unknown → usable (the server decides), unless it is admin only. */
      can: (key) => !hiddenIn(features, Boolean(me), key) && (me ? features[key]?.allowed !== false : true),
      /** Verdict for one feature, or null before /api/me answered. */
      feature: (key) => (me ? features[key] || null : null),
      /** Admin only, and this is not the admin: show nothing at all. */
      hidden: (key) => hiddenIn(features, Boolean(me), key),
      setViewAs,
      refresh,
    };
  }, [me, loading, signedIn, setViewAs, refresh]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

const FALLBACK = {
  loading: true,
  signedIn: false,
  me: null,
  user: null,
  realRole: "free",
  role: "free",
  viewAs: null,
  isAdmin: false,
  previewing: false,
  plan: { key: "free", expiresAt: null },
  registry: null,
  features: {},
  can: (key) => !hiddenIn({}, false, key),
  feature: () => null,
  hidden: (key) => hiddenIn({}, false, key),
  setViewAs: async () => {},
  refresh: async () => null,
};

export function useAccess() {
  return useContext(AccessContext) || FALLBACK;
}

/**
 * The gate for one feature key:
 *   allowed   - render normally
 *   locked    - enabled, but not in this role's plan (grey it out, link to /pricing)
 *   disabled  - switched off for everyone
 *   hidden    - admin only, and this is not the admin (render nothing, or the 404)
 *   known     - /api/me has answered for this feature; until then the
 *               verdict is the catalogue default
 *   adminOnly - in no plan: the admin is looking at something nobody else has
 */
export function useFeatureGate(key) {
  const { feature, can, hidden } = useAccess();
  const verdict = feature(key);
  return {
    allowed: can(key),
    locked: Boolean(verdict && verdict.locked),
    disabled: Boolean(verdict && !verdict.enabled),
    hidden: hidden(key),
    known: Boolean(verdict),
    adminOnly: Boolean(verdict && verdict.adminOnly),
  };
}
