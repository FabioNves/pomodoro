import { z } from "zod";
import User from "@/models/User";
import { connectToDB } from "@/lib/db";
import { validateJsonBody } from "@/utils/apiValidation";
import { requireUser } from "@/lib/sessionAuth";
import { describeAccess, forgetUser, loadUser, meDto, notFoundResponse } from "@/lib/access/server";
import { VIEW_AS_ROLES } from "@/lib/access/features";

export const dynamic = "force-dynamic";

// PUT /api/me/view-as  { viewAs: "premium" | "free" | null }
// Admin preview. Stored on the user's record, so it follows the admin
// across devices and every request resolves it server side. It can only
// lower the role (see effectiveRole); anyone else gets a 404.
export async function PUT(req) {
  const auth = await requireUser(req, { gate: false });
  if (!auth.ok || auth.realRole !== "admin") return notFoundResponse();

  const body = await validateJsonBody(
    req,
    z.object({ viewAs: z.enum(VIEW_AS_ROLES).nullable() }),
  );
  if (!body.ok) return body.response;

  await connectToDB();
  await User.updateOne({ _id: auth.userId }, { $set: { viewAs: body.data.viewAs } });
  forgetUser(auth.userId);
  const user = await loadUser(auth.userId);
  const access = await describeAccess(user);
  return Response.json(meDto({ user, ...access }));
}
