import { requireUser } from "@/lib/sessionAuth";
import { meDto } from "@/lib/access/server";

export const dynamic = "force-dynamic";

// GET /api/me
// The signed-in user's account, role (real and previewed), plan and what
// the feature registry lets that role use. The browser's AccessProvider
// loads this on every page and gates the UI with it; the API routes make
// the same decision on their own, so this is a mirror, not a source.
export async function GET(req) {
  const auth = await requireUser(req, { gate: false });
  if (!auth.ok) return auth.response;
  return Response.json(meDto(auth));
}
