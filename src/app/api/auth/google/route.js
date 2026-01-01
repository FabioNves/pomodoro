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
      user = await User.create({
        name: googleUser.name || googleUser.email,
        email: googleUser.email,
        imageUrl: googleUser.picture,
        googleAccessToken: googleToken,
        googleRefreshToken: refreshToken,
        tokenExpiresAt,
      });
      console.log("New user created with ID:", user._id.toString());
    } else {
      console.log("Updating existing user with ID:", user._id.toString());
      // Update existing user with new tokens (only if we have them)
      if (googleToken && !googleToken.includes(".")) {
        // Only store OAuth access tokens, not JWT credentials
        user.googleAccessToken = googleToken;
      }
      if (refreshToken) user.googleRefreshToken = refreshToken;
      if (tokenExpiresAt) user.tokenExpiresAt = tokenExpiresAt;
      await user.save();
      console.log("User tokens updated");
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
