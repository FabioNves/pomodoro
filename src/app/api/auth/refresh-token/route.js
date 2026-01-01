import axios from "axios";
import User from "@/models/User";
import { connectToDB } from "@/lib/db";

export async function POST(req) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 400,
      });
    }

    await connectToDB();

    let user;
    try {
      user = await User.findById(userId);
    } catch (err) {
      user = await User.findOne({ email: userId });
    }

    if (!user || !user.googleRefreshToken) {
      return new Response(
        JSON.stringify({ error: "No refresh token available" }),
        { status: 404 }
      );
    }

    // Use refresh token to get new access token
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: user.googleRefreshToken,
        grant_type: "refresh_token",
      }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // Update user with new access token
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);
    user.googleAccessToken = access_token;
    user.tokenExpiresAt = tokenExpiresAt;
    await user.save();

    console.log("Token refreshed successfully for:", user.email);

    return new Response(
      JSON.stringify({
        success: true,
        expiresAt: tokenExpiresAt,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error refreshing token:", error.response?.data || error);
    return new Response(
      JSON.stringify({
        error: "Failed to refresh token",
        details: error.message,
      }),
      { status: 500 }
    );
  }
}
