import { z } from "zod";
import User from "@/models/User";
import { connectToDB } from "@/lib/db";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import {
  issueSessionToken,
  publicUser,
  verifyHandoffCode,
} from "@/lib/authTokens";

// POST /api/auth/handoff
// The mobile and desktop apps exchange the short-lived code they received in
// the pomodrive://auth deep link (see /auth/native) for a normal session.
export async function POST(req) {
  const body = await validateJsonBody(
    req,
    z.object({ code: z.string().trim().min(1).max(4096) })
  );
  if (!body.ok) return body.response;

  const userId = verifyHandoffCode(body.data.code);
  if (!userId) return jsonError(401, "Invalid or expired sign-in code");

  try {
    await connectToDB();
    const user = await User.findById(userId);
    if (!user) return jsonError(401, "Unknown user");

    return Response.json({
      token: issueSessionToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Error in handoff auth:", error);
    return jsonError(500, "Sign-in failed");
  }
}
