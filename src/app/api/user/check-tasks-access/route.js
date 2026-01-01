import { connectToDB } from "@/lib/db";
import User from "@/models/User";
import axios from "axios";

export async function GET(req) {
  try {
    const userId = req.headers.get("user-id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 401,
      });
    }

    await connectToDB();

    console.log("Check-tasks-access: Looking up userId:", userId);

    // Try to find user by MongoDB _id first
    let user;
    try {
      user = await User.findById(userId);
      console.log("Found user by ID:", !!user);
    } catch (err) {
      console.log("ID lookup failed, trying email...", err.message);
      user = await User.findOne({ email: userId });
      console.log("Found user by email:", !!user);
    }

    if (!user) {
      console.error("User not found! userId:", userId);
      // List all users to debug
      const allUsers = await User.find({}, { email: 1, _id: 1 }).limit(5);
      console.log(
        "Sample users in DB:",
        allUsers.map((u) => ({ id: u._id.toString(), email: u.email }))
      );

      return new Response(
        JSON.stringify({
          error: "User not found",
          userId: userId,
          hint: "The userId from localStorage doesn't match any user in the database",
        }),
        {
          status: 404,
        }
      );
    }

    console.log("Checking access for user:", user.email);
    console.log("Has token:", !!user.googleAccessToken);
    console.log("Token expires at:", user.tokenExpiresAt);

    // Check if user has Google access token and it's not expired
    const tokenExpired =
      user.tokenExpiresAt && new Date() > user.tokenExpiresAt;
    const hasToken = !!user.googleAccessToken;

    // Verify the token has the correct scopes
    let hasTasksScope = false;
    if (hasToken && !tokenExpired) {
      try {
        const tokenInfo = await axios.get(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${user.googleAccessToken}`
        );
        const scopes = tokenInfo.data.scope || "";
        hasTasksScope = scopes.includes(
          "https://www.googleapis.com/auth/tasks"
        );
        console.log("Token scopes:", scopes);
        console.log("Has tasks scope:", hasTasksScope);
      } catch (err) {
        console.error("Error verifying token:", err.message);
      }
    }

    const hasAccess = hasToken && !tokenExpired && hasTasksScope;

    return new Response(
      JSON.stringify({
        hasAccess,
        tokenExpired,
        hasToken,
        hasTasksScope,
        expiresAt: user.tokenExpiresAt,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error checking tasks access:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to check tasks access",
        details: error.message,
      }),
      { status: 500 }
    );
  }
}
