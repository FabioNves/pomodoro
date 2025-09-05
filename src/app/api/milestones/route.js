import { connectToDB } from "@/lib/db";
import Milestone from "@/models/Milestone";

// POST /api/milestones
export async function POST(req) {
  try {
    const { name } = await req.json();
    const userId = req.headers.get("user-id");

    if (!name) {
      return Response.json(
        { error: "Milestone name is required" },
        { status: 400 }
      );
    }

    await connectToDB();

    const milestoneData = {
      name,
      user: userId || null,
      isTemporary: !userId,
    };

    const milestone = new Milestone(milestoneData);
    await milestone.save();

    return Response.json({ milestone }, { status: 201 });
  } catch (error) {
    console.error("Error creating milestone:", error);
    return Response.json(
      { error: "Error creating milestone" },
      { status: 500 }
    );
  }
}

// GET /api/milestones
export async function GET(req) {
  try {
    const userId = req.headers.get("user-id");

    await connectToDB();

    const query = userId ? { user: userId } : {};
    const milestones = await Milestone.find(query);

    return Response.json(milestones);
  } catch (error) {
    console.error("Error fetching milestones:", error);
    return Response.json(
      { error: "Error fetching milestones" },
      { status: 500 }
    );
  }
}
