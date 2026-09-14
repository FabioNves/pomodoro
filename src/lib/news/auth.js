// Authentication for the news API routes. Server only.
//
// The rest of the API trusts a `user-id` header; the news routes instead
// verify the session JWT (the `accessToken` every client stores) so a user
// can only ever reach their own preferences, briefings and saved stories.
// The verification itself lives in src/lib/sessionAuth.js and is shared with
// the notebook routes; this wrapper only supplies the news-specific message.

import { requireUser as requireSessionUser } from "@/lib/sessionAuth";

/**
 * @param {Request} req
 * @returns {{ ok: true, userId: string } | { ok: false, response: Response }}
 */
export function requireUser(req) {
  return requireSessionUser(req, {
    signInMessage: "Sign in to use the news briefing.",
  });
}
