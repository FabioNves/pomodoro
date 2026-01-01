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

    console.log("Google-tasks: Looking up userId:", userId);

    // Try to find user by MongoDB _id first, if that fails, find by email or other field
    let user;
    try {
      user = await User.findById(userId);
      console.log("Found user by ID for google-tasks:", !!user);
    } catch (err) {
      console.log("ID lookup failed for google-tasks, trying email...");
      // If userId is not a valid ObjectId, try finding by email from decoded JWT
      // This handles cases where userId might be a Google ID or other identifier
      user = await User.findOne({ email: userId });
      console.log("Found user by email for google-tasks:", !!user);
    }

    if (!user) {
      console.error("User not found! userId:", userId);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });
    }

    // Check if user has granted Google Tasks access
    if (!user.googleAccessToken) {
      console.log("User has not granted Google Tasks access");
      return new Response(
        JSON.stringify({
          error: "Google Tasks access not granted",
          message: "You haven't granted access to your Google Tasks yet.",
          instructions: [
            "1. Go to Settings page",
            "2. Click 'Grant Google Tasks Access' button",
            "3. Sign in with your Google account and grant permissions",
            "4. Return here to see your Google Tasks",
          ],
        }),
        { status: 403 }
      );
    }

    console.log(
      "[google-tasks] googleAccessToken exists:",
      !!user.googleAccessToken
    );
    console.log(
      "[google-tasks] Token preview:",
      user.googleAccessToken
        ? `${user.googleAccessToken.substring(0, 30)}...`
        : "null"
    );
    console.log("[google-tasks] Token length:", user.googleAccessToken?.length);

    // Check if token is a JWT (starts with eyJ and has 3 parts) - these can't be used for API calls
    const tokenParts = user.googleAccessToken.split(".");
    const isJWT =
      tokenParts.length === 3 && user.googleAccessToken.startsWith("eyJ");

    console.log("[google-tasks] Token parts:", tokenParts.length);
    console.log(
      "[google-tasks] Starts with eyJ:",
      user.googleAccessToken.startsWith("eyJ")
    );
    console.log("[google-tasks] Is JWT:", isJWT);

    if (isJWT) {
      console.log("Invalid token type detected (JWT credential)");
      // Clear the invalid token
      user.googleAccessToken = null;
      user.tokenExpiresAt = null;
      await user.save();

      return new Response(
        JSON.stringify({
          error: "Invalid token type",
          message:
            "Your authentication token is not valid for Google Tasks API.",
          instructions: [
            "1. Go to Settings page",
            "2. Click 'Grant Google Tasks Access' button",
            "3. Sign in with your Google account and grant permissions",
            "4. Return here to see your Google Tasks",
          ],
        }),
        { status: 403 }
      );
    }

    // Validate token with Google before attempting to use it
    let tokenValid = false;
    try {
      const tokenInfoResponse = await axios.get(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${user.googleAccessToken}`
      );
      console.log("Token is valid. Scopes:", tokenInfoResponse.data.scope);
      tokenValid = true;
    } catch (tokenError) {
      console.log("Token validation failed:", tokenError.response?.status);

      // Token is invalid or expired, try to refresh
      if (user.googleRefreshToken) {
        console.log("Attempting to refresh token...");
        try {
          const refreshResponse = await fetch(
            `${
              process.env.NEXT_PUBLIC_BACKEND_URL_DEV || "http://localhost:3000"
            }/api/auth/refresh-token`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user._id.toString() }),
            }
          );

          if (refreshResponse.ok) {
            console.log("Token refreshed successfully");
            // Reload user to get fresh token
            user = await User.findById(user._id);
            tokenValid = true;
          } else {
            const errorData = await refreshResponse.json();
            console.error("Token refresh failed:", errorData);
            throw new Error("Token refresh failed");
          }
        } catch (refreshError) {
          console.error("Error during token refresh:", refreshError);

          // Clear invalid tokens
          user.googleAccessToken = null;
          user.googleRefreshToken = null;
          user.tokenExpiresAt = null;
          await user.save();

          return new Response(
            JSON.stringify({
              error: "Token expired and refresh failed",
              message:
                "Your Google authentication has expired and could not be refreshed.",
              instructions: [
                "1. Go to Settings page",
                "2. Click 'Grant Google Tasks Access' button",
                "3. Sign in with your Google account and grant permissions",
                "4. Return here to see your Google Tasks",
              ],
            }),
            { status: 401 }
          );
        }
      } else {
        console.log("No refresh token available");

        // Clear invalid token
        user.googleAccessToken = null;
        user.tokenExpiresAt = null;
        await user.save();

        return new Response(
          JSON.stringify({
            error: "Token expired without refresh capability",
            message: "Your Google authentication has expired.",
            instructions: [
              "1. Go to Settings page",
              "2. Click 'Grant Google Tasks Access' button",
              "3. Sign in with your Google account and grant permissions",
              "4. Return here to see your Google Tasks",
            ],
          }),
          { status: 401 }
        );
      }
    }

    // At this point, token should be valid
    if (!tokenValid) {
      return new Response(
        JSON.stringify({
          error: "Unable to validate token",
          message: "Could not establish valid authentication with Google.",
        }),
        { status: 401 }
      );
    }

    // Fetch task lists from Google Tasks API
    try {
      const taskListsResponse = await axios.get(
        "https://www.googleapis.com/tasks/v1/users/@me/lists",
        {
          headers: {
            Authorization: `Bearer ${user.googleAccessToken}`,
          },
        }
      );

      const taskLists = taskListsResponse.data.items || [];

      // Fetch tasks from each task list
      const allTasks = [];
      for (const taskList of taskLists) {
        try {
          const tasksResponse = await axios.get(
            `https://www.googleapis.com/tasks/v1/lists/${taskList.id}/tasks`,
            {
              headers: {
                Authorization: `Bearer ${user.googleAccessToken}`,
              },
              params: {
                showCompleted: false, // Only get incomplete tasks
              },
            }
          );

          const tasks = (tasksResponse.data.items || []).map((task) => ({
            id: task.id,
            title: task.title,
            notes: task.notes,
            status: task.status,
            due: task.due,
            listId: taskList.id,
            listName: taskList.title,
            source: "google",
          }));

          allTasks.push(...tasks);
        } catch (error) {
          console.error(
            `Error fetching tasks from list ${taskList.title}:`,
            error
          );
        }
      }

      return new Response(JSON.stringify({ tasks: allTasks }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (googleApiError) {
      // Handle Google API specific errors
      console.error("Google API Error:", googleApiError.response?.data);

      if (googleApiError.response?.status === 403) {
        const errorDetails = googleApiError.response?.data?.error;
        return new Response(
          JSON.stringify({
            error: "Google Tasks API access denied",
            message: errorDetails?.message || "Access denied",
            reason: errorDetails?.errors?.[0]?.reason || "unknown",
            instructions: [
              "1. Go to Google Cloud Console: https://console.cloud.google.com",
              "2. Select your project",
              "3. Go to 'APIs & Services' > 'Enabled APIs & Services'",
              "4. Click '+ ENABLE APIS AND SERVICES'",
              "5. Search for 'Google Tasks API' and enable it",
              "6. Then go back to /settings and click 'Grant Google Tasks Access' again",
            ],
          }),
          { status: 403 }
        );
      }
      throw googleApiError;
    }
  } catch (error) {
    console.error(
      "Error fetching Google Tasks:",
      error.response?.data || error
    );
    return new Response(
      JSON.stringify({
        error: "Failed to fetch Google Tasks",
        details: error.response?.data?.error?.message || error.message,
      }),
      { status: 500 }
    );
  }
}
