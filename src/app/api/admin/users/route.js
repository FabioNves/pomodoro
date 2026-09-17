import { z } from "zod";
import User from "@/models/User";
import { connectToDB } from "@/lib/db";
import { requireAdmin } from "@/lib/access/admin";
import { ACTIVE_WINDOW_MS, forgetUser, isActiveNow, roleOfUser } from "@/lib/access/server";
import { jsonError, validateJsonBody, validateSearchParams } from "@/utils/apiValidation";

export const dynamic = "force-dynamic";

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 500;

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(["admin", "premium", "free"]).optional(),
  plan: z.enum(["free", "premium"]).optional(),
  sort: z.enum(["lastActive", "email", "signup", "role"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  countOnly: z.enum(["1"]).optional(),
});

const patchSchema = z
  .object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id"),
    plan: z.enum(["free", "premium"]).optional(),
    planExpiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    revokeSessions: z.boolean().optional(),
  })
  .refine((v) => v.plan !== undefined || v.planExpiresAt !== undefined || v.revokeSessions, {
    message: "Nothing to change",
  });

/** "active" (last 15 min), "recent" (24 h), "idle", "revoked" or "never". */
function sessionStatus(user, now) {
  const signedIn = user.lastSignInAt ? new Date(user.lastSignInAt).getTime() : 0;
  const revokedAt = user.sessionsRevokedAt ? new Date(user.sessionsRevokedAt).getTime() : 0;
  if (revokedAt && signedIn <= revokedAt) return "revoked";
  if (isActiveNow(user, now)) return "active";
  const active = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
  if (active && now - active < RECENT_WINDOW_MS) return "recent";
  return active || signedIn ? "idle" : "never";
}

function userRow(user, now = Date.now()) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    imageUrl: user.imageUrl || null,
    role: roleOfUser(user),
    plan: user.plan || "free",
    planExpiresAt: user.planExpiresAt || null,
    viewAs: user.viewAs || null,
    createdAt: user.createdAt || user._id.getTimestamp(),
    lastActiveAt: user.lastActiveAt || null,
    lastSignInAt: user.lastSignInAt || null,
    sessionsRevokedAt: user.sessionsRevokedAt || null,
    sessionStatus: sessionStatus(user, now),
    active: isActiveNow(user, now),
  };
}

const ROLE_ORDER = { admin: 0, premium: 1, free: 2 };

// GET /api/admin/users?q=&role=&plan=&sort=lastActive&dir=desc[&countOnly=1]
// The user table and the live counter. "Active" is a session that made an
// authenticated request within the last 15 minutes.
export async function GET(req) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const query = validateSearchParams(req, listSchema);
  if (!query.ok) return query.response;
  const { q, role, plan, sort = "lastActive", dir = sort === "email" ? "asc" : "desc", countOnly } = query.data;

  try {
    await connectToDB();
    const now = Date.now();
    if (countOnly) {
      const [activeNow, total] = await Promise.all([
        User.countDocuments({ lastActiveAt: { $gte: new Date(now - ACTIVE_WINDOW_MS) } }),
        User.countDocuments({}),
      ]);
      return Response.json({ activeNow, total, activeWindowMinutes: ACTIVE_WINDOW_MS / 60000, at: new Date(now) });
    }

    const filter = {};
    if (plan) filter.plan = plan;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ email: re }, { name: re }];
    }
    const docs = await User.find(filter)
      .select("email name imageUrl plan planExpiresAt viewAs lastActiveAt lastSignInAt sessionsRevokedAt createdAt")
      .limit(MAX_ROWS)
      .lean();

    let rows = docs.map((u) => userRow(u, now));
    if (role) rows = rows.filter((r) => r.role === role);

    const time = (v) => (v ? new Date(v).getTime() : 0);
    const cmp = {
      lastActive: (a, b) => time(a.lastActiveAt) - time(b.lastActiveAt),
      signup: (a, b) => time(a.createdAt) - time(b.createdAt),
      email: (a, b) => a.email.localeCompare(b.email),
      role: (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role],
    }[sort];
    rows.sort((a, b) => (dir === "asc" ? cmp(a, b) : cmp(b, a)));

    const activeNow = await User.countDocuments({ lastActiveAt: { $gte: new Date(now - ACTIVE_WINDOW_MS) } });
    return Response.json({
      users: rows,
      total: rows.length,
      truncated: docs.length >= MAX_ROWS,
      activeNow,
      activeWindowMinutes: ACTIVE_WINDOW_MS / 60000,
      at: new Date(now),
    });
  } catch (error) {
    console.error("[admin] user list failed", error);
    return jsonError(500, "Could not load users");
  }
}

// PATCH /api/admin/users  { id, plan?, planExpiresAt?, revokeSessions? }
// Change a user's plan or sign them out everywhere. Revoking stamps
// sessionsRevokedAt; every session token issued before it is refused by
// requireUser() from the next request on.
export async function PATCH(req) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, patchSchema);
  if (!body.ok) return body.response;
  const { id, plan, planExpiresAt, revokeSessions } = body.data;

  try {
    await connectToDB();
    const $set = {};
    if (plan !== undefined) {
      $set.plan = plan;
      if (plan === "free") $set.planExpiresAt = null;
    }
    if (planExpiresAt !== undefined) $set.planExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null;
    if (revokeSessions) $set.sessionsRevokedAt = new Date();

    const user = await User.findByIdAndUpdate(id, { $set }, { new: true }).lean();
    if (!user) return jsonError(404, "User not found");
    forgetUser(id);
    return Response.json({ user: userRow(user) });
  } catch (error) {
    console.error("[admin] user update failed", error);
    return jsonError(500, "Could not update the user");
  }
}
