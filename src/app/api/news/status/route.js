import { connectToDB } from "@/lib/db";
import { jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { getMcpStatus } from "@/lib/mcp";
import { isOpenAiConfigured } from "@/lib/ai";
import { getOrCreatePreferences } from "@/lib/news/preferences";
import { nextDelivery } from "@/lib/news/schedule";
import { connectionStatus } from "@/lib/access/connections";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/news/status
// What the news screen needs to know about the server: the next scheduled
// delivery and whether briefings can be generated at all. Only the admin
// gets the connection details (servers, tools, models, scheduler); the
// canonical place for those is /api/admin/connections.
export async function GET(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    if (auth.role === "admin") {
      const [status, prefResult] = await Promise.all([
        connectionStatus(),
        connectToDB().then(() => getOrCreatePreferences(auth.userId)),
      ]);
      return Response.json({ ...status, nextDelivery: nextDelivery(prefResult.pref) });
    }

    const mcpPromise = getMcpStatus();
    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve({ configured: true, connected: false }), 15000),
    );
    const [mcp, prefResult] = await Promise.all([
      Promise.race([mcpPromise, timeout]),
      connectToDB().then(() => getOrCreatePreferences(auth.userId)),
    ]);
    return Response.json({
      available: Boolean(mcp?.connected) && isOpenAiConfigured(),
      nextDelivery: nextDelivery(prefResult.pref),
    });
  } catch (error) {
    console.error("[news] status failed", error);
    return jsonError(500, "Could not check the news services");
  }
}
