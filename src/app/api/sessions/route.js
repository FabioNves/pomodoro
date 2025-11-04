import { connectToDB } from "@/lib/db";
import Session from "@/models/Session";
import { jwtDecode } from "jwt-decode";
import { getUserFromRequest } from "@/utils/getUserFromRequest";

export async function POST(req) {
  try {
    const userId = req.headers.get("user-id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 401,
      });
    }

    const { focusTime, breakTime, tasks, currentProject } = await req.json();

    await connectToDB();

    const newSession = new Session({
      focusTime,
      breakTime,
      tasks,
      currentProject, // Add this field
      user: userId,
    });

    await newSession.save();
    return new Response(
      JSON.stringify({ message: "Session saved successfully" }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving session:", error);
    return new Response(JSON.stringify({ error: "Error saving session" }), {
      status: 500,
    });
  }
}

export async function GET(req) {
  try {
    const userId = req.headers.get("user-id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 401,
      });
    }

    await connectToDB();

    const sessions = await Session.find({ user: userId });
    return new Response(JSON.stringify(sessions), { status: 200 });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return new Response(JSON.stringify({ error: "Error fetching sessions" }), {
      status: 500,
    });
  }
}

export const createBrand = async (name) => {
  const token = localStorage.getItem("accessToken");
  console.log("Access Token:", token);
  const decodedToken = jwtDecode(token); // Decode the JWT to get the user ID
  console.log("Decoded Token:", decodedToken);
  const userId = decodedToken.userId;

  const response = await fetch("/api/brands", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "user-id": userId, // Pass user ID in headers
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error("Failed to create brand");
  }

  return response.json();
};

export const fetchSessions = async () => {
  const userId = localStorage.getItem("userId");
  const response = await fetch("/api/sessions", {
    headers: { "user-id": userId },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch sessions");
  }

  return response.json();
};
