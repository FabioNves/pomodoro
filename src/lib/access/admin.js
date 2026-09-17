// Admin-only routes. Server only.
//
// The admin is whoever signs in with the configured admin email; a preview
// role never changes that. Everyone else, signed in or not, gets a 404 so
// the routes are not discoverable.

import { requireUser } from "@/lib/sessionAuth";
import { notFoundResponse } from "@/lib/access/server";

/**
 * @param {Request} req
 * @returns {Promise<{ ok: true, userId: string, email: string, user: object } | { ok: false, response: Response }>}
 */
export async function requireAdmin(req) {
  const auth = await requireUser(req, { gate: false });
  if (!auth.ok || auth.realRole !== "admin") {
    return { ok: false, response: notFoundResponse() };
  }
  return auth;
}
