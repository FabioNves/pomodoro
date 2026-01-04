import jwt from "jsonwebtoken";
import User from "@/models/User";
import { connectToDB } from "@/lib/db";
import { z } from "zod";
import { validateJsonBody } from "@/utils/apiValidation";

export async function POST(req) {
  try {
    const body = await validateJsonBody(
      req,
      z.object({ googleToken: z.string().trim().min(1).max(4096) })
    );
    if (!body.ok) return body.response;

    const { googleToken } = body.data;

    // Credential flow only: JWT tokens have 3 parts and start with "eyJ"
    const tokenParts = googleToken.split(".");
    const isJWT = tokenParts.length === 3 && googleToken.startsWith("eyJ");
    if (!isJWT) {
      return new Response(
        JSON.stringify({
          error: "Unsupported token type",
          message:
            "This app only supports Google credential (JWT) sign-in. OAuth access tokens are not accepted.",
        }),
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
      return new Response(JSON.stringify({ error: "Invalid Google token" }), {
        status: 401,
      });
    }

    if (!googleUser || !googleUser.email) {
      return new Response(JSON.stringify({ error: "Invalid Google token" }), {
        status: 401,
      });
    }

    await connectToDB();

    // 2. Find or create user in your DB
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

    // 3. Issue your own JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return new Response(
      JSON.stringify({
        token,
        user: {
          _id: user._id.toString(),
          userId: user._id.toString(),
          googleSub: user.googleSub || null,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in Google auth:", error);
    return new Response(
      JSON.stringify({ error: "Google authentication failed" }),
      { status: 500 }
    );
  }
}
