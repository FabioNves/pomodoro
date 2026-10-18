import User from "@/models/User";
import { connectToDB } from "@/lib/db";
import { HUB_ADMIN_MS, consumeHubJti, issueHubTicket } from "@/lib/hub";
import { HubTokenError, hubConfigured, safeNextPath, verifyHubToken } from "@/lib/hub-client.mjs";

export const dynamic = "force-dynamic";

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const page = (status, message) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>PomoDRIVE</title><p style="font-family:system-ui;padding:2rem">${escapeHtml(message)}</p>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

// POST /api/hub/sso
// "Open admin" from the Movez Hub (form field `token`, see src/lib/hub.js).
// Hub admins get the admin role for 12 hours (renewed each time); the
// account is created on first visit.
export async function POST(req) {
  if (!hubConfigured()) return page(503, "Hub sign-in is not configured.");

  const form = await req.formData();
  let claims;
  try {
    claims = await verifyHubToken(String(form.get("token") ?? ""), "sso", consumeHubJti);
  } catch (err) {
    if (err instanceof HubTokenError) {
      console.warn("[hub] sign-in rejected:", err.message);
      return page(401, "This sign-in link has expired or was already used. Open it again from the hub.");
    }
    throw err;
  }

  const email = claims.email?.trim().toLowerCase();
  if (!email) return page(400, "The hub did not send an email address.");

  await connectToDB();
  const hubAdminUntil = claims.role === "admin" ? new Date(Date.now() + HUB_ADMIN_MS) : null;
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { hubAdminUntil }, $setOnInsert: { email, name: claims.name || email } },
    { upsert: true, new: true },
  );
  console.log(`[hub] sign-in for ${email}${hubAdminUntil ? " (admin)" : ""} by hub user ${claims.sub}`);

  const ticket = await issueHubTicket(claims.jti, user._id);
  const next = safeNextPath(form.get("next"), "/admin");
  // The ticket goes in the fragment, which browsers never send to a server.
  return new Response(null, {
    status: 303,
    headers: {
      location: `/auth/hub#ticket=${encodeURIComponent(ticket)}&next=${encodeURIComponent(next)}`,
      "cache-control": "no-store",
    },
  });
}
