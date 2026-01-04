import { connectToDB } from "@/lib/db";
import Milestone from "@/models/Milestone";
import { z } from "zod";
import { validateJsonBody } from "@/utils/apiValidation";

const milestoneSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const optionalUserIdSchema = z.string().trim().min(1).max(256).optional();

// POST /api/milestones
export async function POST(req) {
  try {
    const body = await validateJsonBody(req, milestoneSchema);
    if (!body.ok) return body.response;

    const userIdRaw = req.headers.get("user-id") ?? undefined;
    const userId = optionalUserIdSchema.safeParse(userIdRaw).success
      ? userIdRaw
      : undefined;

    const { name } = body.data;

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
    const userIdRaw = req.headers.get("user-id") ?? undefined;
    const userId = optionalUserIdSchema.safeParse(userIdRaw).success
      ? userIdRaw
      : undefined;

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
