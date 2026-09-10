// Client-side session helpers shared by every sign-in entry point (home page,
// navbar modal, timer page) and by the native deep-link flow.

import { DEEP_LINK_SCHEME, apiUrl } from "@/lib/platform";

const SESSION_KEYS = ["accessToken", "userId", "userName"];

export function storeSession({ token, user }) {
  localStorage.setItem("accessToken", token);
  localStorage.setItem("userId", user.userId || user._id);
  localStorage.setItem("userName", user.name);
}

export function clearSession() {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}

async function postJson(path, body) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Exchange a Google credential for a PomoDRIVE session and persist it. */
export async function signInWithGoogleCredential(credential) {
  const data = await postJson("/api/auth/google", { googleToken: credential });
  storeSession(data);
  return data.user;
}

/** Website side of native sign-in: get a short-lived handoff code. */
export async function createHandoffCode(credential) {
  const { handoffCode } = await postJson("/api/auth/google", {
    googleToken: credential,
    handoff: true,
  });
  return handoffCode;
}

/** App side of native sign-in: turn the handoff code into a session. */
export async function signInWithHandoffCode(code) {
  const data = await postJson("/api/auth/handoff", { code });
  storeSession(data);
  return data.user;
}

/** Deep link the website sends the app back to after signing in. */
export function authDeepLink(code) {
  return `${DEEP_LINK_SCHEME}://auth?code=${encodeURIComponent(code)}`;
}

/** Parse a deep link; returns { code } for an auth link, otherwise null. */
export function parseAuthDeepLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${DEEP_LINK_SCHEME}:` || parsed.host !== "auth") {
      return null;
    }
    const code = parsed.searchParams.get("code");
    return code ? { code } : null;
  } catch {
    return null;
  }
}
