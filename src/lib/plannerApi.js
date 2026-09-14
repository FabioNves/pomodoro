// Browser-side helper for the planner API (projects, tasks, milestones,
// habits, week plans). Sends the planner identity headers (a signed-in user
// id or the anonymous session id) and, when signed in, the session token as
// a Bearer header for the routes that verify it (AI suggestions).
//
// Paths stay relative: inside the app shells src/lib/platform.js redirects
// them to the API server.

import { generateSessionId } from "@/utils/sessionUtils";

export function getIdentityHeaders() {
  if (typeof window === "undefined") return {};
  const headers = {};
  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("accessToken");
  if (userId) headers["user-id"] = userId;
  else headers["session-id"] = generateSessionId();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function isSignedIn() {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("accessToken"));
}

export async function apiJson(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...getIdentityHeaders(),
    "Content-Type": "application/json",
  };
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.code = data?.code || null;
    throw error;
  }
  return res.json();
}
