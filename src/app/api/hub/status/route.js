import User from "@/models/User";
import Briefing from "@/models/Briefing";
import { connectToDB } from "@/lib/db";
import { ACTIVE_WINDOW_MS } from "@/lib/access/server";
import { verifyHubServiceToken } from "@/lib/hub-client.mjs";

export const dynamic = "force-dynamic";

// GET /api/hub/status
// The Movez Hub dashboard card; answers hub service tokens only.
export async function GET(req) {
  if (!(await verifyHubServiceToken(req.headers.get("authorization")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectToDB();
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 3600 * 1000);
  const [users, newToday, activeNow, premium, briefingsToday] = await Promise.all([
    User.estimatedDocumentCount(),
    User.countDocuments({ createdAt: { $gte: dayAgo } }),
    User.countDocuments({ lastActiveAt: { $gte: new Date(now - ACTIVE_WINDOW_MS) } }),
    User.countDocuments({ plan: "premium", $or: [{ planExpiresAt: null }, { planExpiresAt: { $gt: new Date(now) } }] }),
    Briefing.countDocuments({ createdAt: { $gte: dayAgo } }),
  ]);

  return Response.json(
    {
      health: "ok",
      counters: [
        { label: "Users", value: users },
        { label: "New today", value: newToday },
        { label: "Active now", value: activeNow },
        { label: "Premium", value: premium },
        { label: "Briefings 24 h", value: briefingsToday },
      ],
      links: [{ label: "Site", url: "https://pomodrive.vercel.app" }],
    },
    { headers: { "cache-control": "no-store" } },
  );
}
