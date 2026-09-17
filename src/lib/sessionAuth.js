// Session verification for API routes that hold private data. Server only.
//
// Most of the older API trusts an unverified `user-id` header. The news,
// notebook, planner-AI and account routes instead verify the session JWT
// (the `accessToken` every client stores) so a user can only ever reach
// their own records.
//
// A valid signature is not enough: the token must also carry the session
// marker that only issueSessionToken() sets (see src/lib/authTokens.js).
// Other tokens signed with the same secret (the two-minute native handoff
// code, or anything minted by another route) are rejected here.
//
// Beyond the signature, requireUser() looks the user up so that
//   - sessions revoked from the admin page stop working at once,
//   - the caller's role and plan are known (src/lib/access/server.js),
//   - the feature behind the route is checked: a locked feature answers 403
//     with { code: "feature_locked" | "feature_disabled", feature }.

import jwt from "jsonwebtoken";
import { SESSION_PURPOSE } from "@/lib/authTokens";
import { jsonError } from "@/utils/apiValidation";
import {
  describeAccess,
  denyIfLocked,
  featuresFor,
  loadUser,
  touchActivity,
} from "@/lib/access/server";
import { recordRequest, enterUsageContext } from "@/lib/usage/track";

/**
 * Signature and claims only; no database access.
 * @param {Request} req
 * @returns {{ ok: true, payload: object } | { ok: false, response: Response }}
 */
export function verifySessionToken(req, { signInMessage = "Sign in to continue." } = {}) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { ok: false, response: jsonError(401, signInMessage) };
  }
  if (!process.env.JWT_SECRET) {
    console.error("[auth] JWT_SECRET is not set; cannot verify sessions.");
    return { ok: false, response: jsonError(500, "Server is not configured for sign-in.") };
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (!payload || typeof payload !== "object") throw new Error("malformed token");
    if (payload.purpose !== SESSION_PURPOSE) throw new Error("not a session token");
    if (!payload.userId) throw new Error("token has no userId");
    return { ok: true, payload };
  } catch {
    return {
      ok: false,
      response: jsonError(401, "Your session has expired. Please sign in again."),
    };
  }
}

/**
 * @param {Request} req
 * @param {{ signInMessage?: string, feature?: string|string[], gate?: boolean }} [options]
 *   feature: feature key(s) this route needs, on top of the one derived
 *            from the path (see featureForPath); gate: false skips the
 *            feature check (account routes).
 * @returns {Promise<{ ok: true, userId: string, email: string, user: object,
 *   realRole: string, role: string, viewAs: string|null, features: object,
 *   registry: object } | { ok: false, response: Response }>}
 */
export async function requireUser(req, { signInMessage = "Sign in to continue.", feature, gate = true } = {}) {
  const verified = verifySessionToken(req, { signInMessage });
  if (!verified.ok) return verified;
  const { payload } = verified;

  let user;
  try {
    user = await loadUser(payload.userId);
  } catch (error) {
    console.error("[auth] could not load the session's user:", error);
    return { ok: false, response: jsonError(500, "Could not verify the session.") };
  }
  if (!user) {
    return { ok: false, response: jsonError(401, "Your account was not found. Please sign in again.") };
  }
  if (user.sessionsRevokedAt && payload.iat && payload.iat * 1000 < new Date(user.sessionsRevokedAt).getTime()) {
    return {
      ok: false,
      response: Response.json(
        { error: "You were signed out. Please sign in again.", code: "session_revoked" },
        { status: 401 },
      ),
    };
  }

  const access = await describeAccess(user);
  const keys = featuresFor(req, feature);
  const userId = String(user._id);
  touchActivity(userId);
  enterUsageContext({ userId, feature: keys[0] || "other" });
  recordRequest(req, userId, { feature: keys[0] });

  if (gate) {
    const denied = denyIfLocked(access.registry, access.role, keys);
    if (denied) return { ok: false, response: denied };
  }

  return { ok: true, userId, email: user.email, user, ...access };
}
