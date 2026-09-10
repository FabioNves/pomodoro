import { z } from "zod";
import User from "@/models/User";
import { connectToDB } from "@/lib/db";
import { validateJsonBody, jsonError } from "@/utils/apiValidation";
import {
  issueHandoffCode,
  issueSessionToken,
  publicUser,
} from "@/lib/authTokens";

// POST /api/auth/google
// Exchanges a Google credential (ID token) for a PomoDRIVE session.
// With `handoff: true` (used by /auth/native on behalf of the mobile and
// desktop apps) it returns a short-lived code instead, which the app trades
// for a session at /api/auth/handoff.
export async function POST(req) {
  try {
    const body = await validateJsonBody(
      req,
      z.object({
        googleToken: z.string().trim().min(1).max(4096),
        handoff: z.boolean().optional(),
      })
    );
    if (!body.ok) return body.response;

    const { googleToken, handoff } = body.data;

    // Credential flow only: JWT tokens have 3 parts and start with "eyJ"
    const tokenParts = googleToken.split(".");
    const isJWT = tokenParts.length === 3 && googleToken.startsWith("eyJ");
    if (!isJWT) {
      return Response.json(
        {
          error: "Unsupported token type",
          message:
            "This app only supports Google credential (JWT) sign-in. OAuth access tokens are not accepted.",
        },
        { status: 400 }
      );
    }

    let googleUser;
    try {
      const { jwtDecode } = await import("jwt-decode");
      const decoded = jwtDecode(googleToken);
      googleUser = {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      };
    } catch (decodeError) {
      return jsonError(401, "Invalid Google token");
    }

    if (!googleUser || !googleUser.email) {
      return jsonError(401, "Invalid Google token");
    }

    await connectToDB();

    // Find or create the user
    let user = await User.findOne({ email: googleUser.email });

    if (!user) {
      user = await User.create({
        name: googleUser.name || googleUser.email,
        email: googleUser.email,
        imageUrl: googleUser.picture,
        googleSub: googleUser.sub,
      });
    } else {
      // Keep user info fresh
      if (googleUser.name && user.name !== googleUser.name)
        user.name = googleUser.name;
      if (googleUser.picture && user.imageUrl !== googleUser.picture) {
        user.imageUrl = googleUser.picture;
      }
      if (googleUser.sub && user.googleSub !== googleUser.sub) {
        user.googleSub = googleUser.sub;
      }
      await user.save();
    }

    if (handoff) {
      return Response.json({ handoffCode: issueHandoffCode(user) });
    }

    return Response.json({
      token: issueSessionToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Error in Google auth:", error);
    return jsonError(500, "Google authentication failed");
  }
}
