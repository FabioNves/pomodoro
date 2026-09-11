import { connectToDB } from "@/lib/db";
import { jsonError } from "@/utils/apiValidation";
import { requireUser } from "@/lib/news/auth";
import { getMcpStatus } from "@/lib/mcp";
import { isOpenAiConfigured, getAiConfig } from "@/lib/ai";
import { getOrCreatePreferences } from "@/lib/news/preferences";
import { nextDelivery } from "@/lib/news/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/news/status
// Connection health for the settings page: is an MCP server configured and
// reachable, which tools were detected, is OpenAI configured, is the cron
// secret set. Requires a signed-in user; never returns secrets.
export async function GET(req) {
  const auth = requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const mcpPromise = getMcpStatus();
    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve({ configured: true, connected: false, error: "Timed out while contacting the MCP server." }), 15000),
    );
    const [mcp, prefResult] = await Promise.all([
      Promise.race([mcpPromise, timeout]),
      connectToDB().then(() => getOrCreatePreferences(auth.userId)),
    ]);
    const { model } = getAiConfig();
    return Response.json({
      mcp,
      ai: { configured: isOpenAiConfigured(), model },
      scheduler: { configured: Boolean((process.env.CRON_SECRET || "").trim()) },
      nextDelivery: nextDelivery(prefResult.pref),
    });
  } catch (error) {
    console.error("[news] status failed", error);
    return jsonError(500, "Could not check the news services");
  }
}
