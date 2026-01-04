import { connectToDB } from "@/lib/db";
import Brand from "@/models/Brand";
import { z } from "zod";
import { validateJsonBody } from "@/utils/apiValidation";

const brandSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const optionalUserIdSchema = z.string().trim().min(1).max(256).optional();

// POST /api/brands
export async function POST(req) {
  try {
    const body = await validateJsonBody(req, brandSchema);
    if (!body.ok) return body.response;

    const userIdRaw = req.headers.get("user-id") ?? undefined;
    const userId = optionalUserIdSchema.safeParse(userIdRaw).success
      ? userIdRaw
      : undefined;

    const { name } = body.data;

    await connectToDB();

    const brandData = {
      name,
      user: userId || null,
      isTemporary: !userId,
    };

    const brand = new Brand(brandData);
    await brand.save();

    return Response.json(brand, { status: 201 });
  } catch (error) {
    console.error("Error creating brand:", error);
    return Response.json({ error: "Error creating brand" }, { status: 500 });
  }
}

// GET /api/brands
export async function GET(request) {
  try {
    const userIdRaw = request.headers.get("user-id") ?? undefined;
    const userId = optionalUserIdSchema.safeParse(userIdRaw).success
      ? userIdRaw
      : undefined;

    await connectToDB();

    const query = userId ? { user: userId } : {};
    const brands = await Brand.find(query);

    return Response.json(brands);
  } catch (error) {
    console.error("Error fetching brands:", error);
    return Response.json({ error: "Error fetching brands" }, { status: 500 });
  }
}
