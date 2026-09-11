// Authentication for the news API routes. Server only.
//
// The rest of the API trusts a `user-id` header; the news routes instead
// verify the session JWT (the `accessToken` every client stores) so a user
// can only ever reach their own preferences, briefings and saved stories.
//
// A valid signature is not enough: the token must also carry the session
// marker that only issueSessionToken() sets (see src/lib/authTokens.js).
// Other tokens signed with the same secret — the two-minute native handoff
// code, or anything minted by another route — are rejected here.

import jwt from "jsonwebtoken";
import { SESSION_PURPOSE } from "@/lib/authTokens";
import { jsonError } from "@/utils/apiValidation";

/**
 * @param {Request} req
 * @returns {{ ok: true, userId: string } | { ok: false, response: Response }}
 */
export function requireUser(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { ok: false, response: jsonError(401, "Sign in to use the news briefing.") };
  }
  if (!process.env.JWT_SECRET) {
    console.error("[news] JWT_SECRET is not set; cannot verify sessions.");
    return { ok: false, response: jsonError(500, "Server is not configured for sign-in.") };
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (!payload || typeof payload !== "object") throw new Error("malformed token");
    if (payload.purpose !== SESSION_PURPOSE) throw new Error("not a session token");
    if (!payload.userId) throw new Error("token has no userId");
    return { ok: true, userId: String(payload.userId) };
  } catch {
    return {
      ok: false,
      response: jsonError(401, "Your session has expired. Please sign in again."),
    };
  }
}
