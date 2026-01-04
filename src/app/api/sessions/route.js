import { connectToDB } from "@/lib/db";
import Session from "@/models/Session";
import { jwtDecode } from "jwt-decode";
import { getUserFromRequest } from "@/utils/getUserFromRequest";
import { z } from "zod";
import { validateJsonBody } from "@/utils/apiValidation";

const userIdHeaderSchema = z.string().trim().min(1).max(256);

const sessionTaskSchema = z.object({
  task: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
  brand: z.object({
    title: z.string().trim().min(1).max(80),
    milestone: z.string().trim().min(1).max(80).optional(),
  }),
});

const sessionBodySchema = z.object({
  focusTime: z.number().int().min(0).max(86_400),
  breakTime: z.number().int().min(0).max(86_400),
  tasks: z.array(sessionTaskSchema).max(200).optional().default([]),
  currentProject: z.object({
    title: z.string().trim().min(1).max(80),
    milestone: z.string().trim().min(1).max(80).optional(),
  }),
});

export async function POST(req) {
  try {
    const userId = req.headers.get("user-id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 401,
      });
    }

    const userIdValidation = userIdHeaderSchema.safeParse(userId);
    if (!userIdValidation.success) {
      return new Response(JSON.stringify({ error: "Invalid user-id header" }), {
        status: 401,
      });
    }

    const body = await validateJsonBody(req, sessionBodySchema);
    if (!body.ok) return body.response;

    const { focusTime, breakTime, tasks, currentProject } = body.data;

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

    const userIdValidation = userIdHeaderSchema.safeParse(userId);
    if (!userIdValidation.success) {
      return new Response(JSON.stringify({ error: "Invalid user-id header" }), {
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
