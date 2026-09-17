import { requireAdmin } from "@/lib/access/admin";
import { connectionStatus } from "@/lib/access/connections";
import { jsonError } from "@/utils/apiValidation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/admin/connections[?refresh=1]
// The admin's Connections section: MCP servers, OpenAI, scheduler, database,
// sign-in configuration and last activity. Admin only (404 otherwise).
export async function GET(req) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    return Response.json(await connectionStatus({ refresh }));
  } catch (error) {
    console.error("[admin] connection status failed", error);
    return jsonError(500, "Could not check the connections");
  }
}
