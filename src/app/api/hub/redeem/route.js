import { z } from "zod";
import User from "@/models/User";
import { connectToDB } from "@/lib/db";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import { issueSessionToken, markSignedIn, publicUser } from "@/lib/authTokens";
import { redeemHubTicket } from "@/lib/hub";

// POST /api/hub/redeem { ticket }
// /auth/hub exchanges the one-time ticket from /api/hub/sso for a session.
export async function POST(req) {
  const body = await validateJsonBody(req, z.object({ ticket: z.string().trim().min(1).max(200) }));
  if (!body.ok) return body.response;

  const userId = await redeemHubTicket(body.data.ticket);
  if (!userId) return jsonError(401, "This sign-in link has expired or was already used.");

  await connectToDB();
  const user = await User.findById(userId);
  if (!user) return jsonError(401, "Unknown user");
  await markSignedIn(user._id);
  return Response.json({ token: issueSessionToken(user), user: publicUser(user) });
}
