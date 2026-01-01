import jwt from "jsonwebtoken";
import axios from "axios";
import User from "@/models/User";
import { connectToDB } from "@/lib/db";

export async function POST(req) {
  try {
    const { code } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Authorization code required" }),
        {
          status: 400,
        }
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: "postmessage", // For auth-code flow
        grant_type: "authorization_code",
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Verify the token and get user info
    const googleUserRes = await axios.get(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${access_token}`
    );
    const googleUser = googleUserRes.data;

    if (!googleUser || !googleUser.email) {
      return new Response(JSON.stringify({ error: "Invalid Google token" }), {
        status: 401,
      });
    }

    await connectToDB();

    // Find existing user
    let user = await User.findOne({ email: googleUser.email });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found. Please sign in first." }),
        { status: 404 }
      );
    }

    // Update user with new tokens
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);
    user.googleAccessToken = access_token;
    if (refresh_token) user.googleRefreshToken = refresh_token;
    user.tokenExpiresAt = tokenExpiresAt;
    await user.save();

    // Issue new JWT
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
    console.error("Error in Google reauth:", error);
    return new Response(
      JSON.stringify({
        error: "Google reauthorization failed",
        details: error.message,
      }),
      { status: 500 }
    );
  }
}
