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
    if (googleToken.includes(".")) {
      // It's a JWT credential from <GoogleLogin> component
      console.log("Handling JWT credential from GoogleLogin");
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
        console.error("Failed to decode JWT:", decodeError);
        return new Response(
          JSON.stringify({ error: "Invalid Google JWT token" }),
          {
            status: 401,
          }
        );
      }
    } else {
      // It's an OAuth access token from useGoogleLogin
      console.log("Handling OAuth access token from useGoogleLogin");
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

    console.log("Login attempt for email:", googleUser.email);
    console.log("User found in DB:", !!user);

    if (!user) {
      console.log("Creating new user...");
      // For new users, only store OAuth tokens, not JWT credentials
      const tokensToStore = googleToken.includes(".")
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
      console.log("New user created with ID:", user._id.toString());
    } else {
      console.log("Updating existing user with ID:", user._id.toString());

      // If it's a JWT credential (from normal login)
      if (googleToken.includes(".")) {
        console.log("JWT credential detected - clearing old/invalid tokens");
        // Clear any expired or invalid tokens that might cause API errors
        const now = new Date();
        if (user.tokenExpiresAt && user.tokenExpiresAt < now) {
          console.log("Clearing expired tokens");
          user.googleAccessToken = null;
          user.googleRefreshToken = null;
          user.tokenExpiresAt = null;
        } else if (
          user.googleAccessToken &&
          user.googleAccessToken.includes(".")
        ) {
          // Clear JWT credentials that were incorrectly stored as access tokens
          console.log("Clearing invalid JWT credential stored as access token");
          user.googleAccessToken = null;
          user.tokenExpiresAt = null;
        }
      } else {
        // It's an OAuth access token (from Settings page)
        console.log("OAuth access token detected - updating tokens");
        user.googleAccessToken = googleToken;
        user.tokenExpiresAt = tokenExpiresAt;
        if (refreshToken) {
          user.googleRefreshToken = refreshToken;
        }
      }

      await user.save();
      console.log("User updated");
    }

    // 3. Issue your own JWT
    console.log("[auth/google] Signing JWT with JWT_SECRET for userId:", user._id.toString());
    console.log("[auth/google] JWT_SECRET exists:", !!process.env.JWT_SECRET);
    console.log("[auth/google] JWT_SECRET length:", process.env.JWT_SECRET?.length);
    
    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    console.log("[auth/google] Generated token:", token ? `${token.substring(0, 50)}...` : "null");

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
