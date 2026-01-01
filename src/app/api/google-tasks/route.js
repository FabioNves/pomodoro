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

    if (!user || !user.googleAccessToken) {
      console.error(
        "User not found or no token! userId:",
        userId,
        "hasToken:",
        !!user?.googleAccessToken
      );
      return new Response(
        JSON.stringify({ error: "User not authenticated with Google" }),
        { status: 401 }
      );
    }

    // Check if token is expired
    if (user.tokenExpiresAt && new Date() > user.tokenExpiresAt) {
      // Try to refresh the token automatically
      console.log("Token expired, attempting refresh...");

      if (user.googleRefreshToken) {
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
            console.log("Token refreshed successfully, retrying...");
            // Reload user to get fresh token
            user = await User.findById(user._id);
          } else {
            throw new Error("Token refresh failed");
          }
        } catch (refreshError) {
          console.error("Failed to refresh token:", refreshError);
          return new Response(
            JSON.stringify({
              error:
                "Google token expired. Please go to Settings and grant access again.",
            }),
            { status: 401 }
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            error:
              "Google token expired. Please go to Settings and grant access again.",
          }),
          { status: 401 }
        );
      }
    }

    // Verify token info first
    try {
      const tokenInfo = await axios.get(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${user.googleAccessToken}`
      );
      console.log("Token scopes:", tokenInfo.data.scope);
    } catch (err) {
      console.error("Error verifying token:", err);
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
