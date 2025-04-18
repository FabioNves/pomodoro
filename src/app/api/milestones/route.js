import { connectToDB } from "@/lib/db";
import Milestone from "@/models/Milestone";
import { jwtDecode } from "jwt-decode";

// POST /api/milestones
export async function POST(req) {
  try {
    const userId = req.headers.get("user-id"); // <-- Use user-id header
    const { name } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
      });
    }

    await connectToDB();

    const newMilestone = new Milestone({ name, user: userId });
    await newMilestone.save();

    return new Response(
      JSON.stringify({
        message: "Milestone saved successfully",
        milestone: newMilestone,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving milestone:", error);
    return new Response(JSON.stringify({ error: "Error saving milestone" }), {
      status: 500,
    });
  }
}

// GET /api/milestones
export async function GET(req) {
  try {
    const userId = req.headers.get("user-id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 401,
      });
    }

    await connectToDB();
    const milestones = await Milestone.find({ user: userId });
    return new Response(JSON.stringify(milestones), { status: 200 });
  } catch (error) {
    console.error("Error fetching milestones:", error);
    return new Response(
      JSON.stringify({ error: "Error fetching milestones" }),
      {
        status: 500,
      }
    );
  }
}

const fetchMilestones = async () => {
  const token = localStorage.getItem("accessToken");
  const decodedToken = jwtDecode(token); // Decode the JWT to get the user ID
  const userId = decodedToken.userId;

  const response = await fetch("/api/milestones", {
    method: "GET",
    headers: {
      "user-id": userId, // Pass user ID in headers
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch milestones");
  }

  return response.json();
};
