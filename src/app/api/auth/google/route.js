import jwt from "jsonwebtoken";
import axios from "axios";
import User from "@/models/User";
import { connectToDB } from "@/lib/db";

export async function POST(req) {
  try {
    const { googleToken, refreshToken, expiresIn } = await req.json();

    let googleUser;
    let tokenExpiresAt;

    // Detect token type: JWT credential vs OAuth access token
    // JWT tokens have exactly 3 parts separated by dots AND start with "eyJ"
    const tokenParts = googleToken.split(".");
    const isJWT = tokenParts.length === 3 && googleToken.startsWith("eyJ");

    if (isJWT) {
      // It's a JWT credential from <GoogleLogin> component
      try {
        const { jwtDecode } = await import("jwt-decode");
        const decoded = jwtDecode(googleToken);
        googleUser = {
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
        };
        // JWT credentials expire in 1 hour by default
        tokenExpiresAt = new Date(decoded.exp * 1000);
      } catch (decodeError) {
        return new Response(
          JSON.stringify({ error: "Invalid Google JWT token" }),
          {
            status: 401,
          }
        );
      }
    } else {
      // It's an OAuth access token from useGoogleLogin
      const googleUserRes = await axios.get(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${googleToken}`
      );
      googleUser = googleUserRes.data;
      tokenExpiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000);
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
      // For new users, only store OAuth tokens, not JWT credentials
      const tokensToStore = isJWT
        ? {
            googleAccessToken: null,
            googleRefreshToken: null,
            tokenExpiresAt: null,
          }
        : {
            googleAccessToken: googleToken,
            googleRefreshToken: refreshToken,
            tokenExpiresAt,
          };

      user = await User.create({
        name: googleUser.name || googleUser.email,
        email: googleUser.email,
        imageUrl: googleUser.picture,
        ...tokensToStore,
      });
    } else {
      // If it's a JWT credential (from normal login)
      if (isJWT) {
        // Only clear expired or JWT credentials that were incorrectly stored
        const now = new Date();
        if (user.tokenExpiresAt && user.tokenExpiresAt < now) {
          user.googleAccessToken = null;
          user.googleRefreshToken = null;
          user.tokenExpiresAt = null;
        } else if (
          user.googleAccessToken &&
          user.googleAccessToken.startsWith("eyJ") &&
          user.googleAccessToken.split(".").length === 3
        ) {
          // Clear JWT credentials that were incorrectly stored as access tokens
          user.googleAccessToken = null;
          user.tokenExpiresAt = null;
        }
      } else {
        // It's an OAuth access token (from Settings page)
        user.googleAccessToken = googleToken;
        user.tokenExpiresAt = tokenExpiresAt;
        if (refreshToken) {
          user.googleRefreshToken = refreshToken;
        }
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
