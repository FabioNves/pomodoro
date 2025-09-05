import { connectToDB } from "@/lib/db";
import Brand from "@/models/Brand";

// POST /api/brands
export async function POST(req) {
  try {
    const { name } = await req.json();
    const userId = req.headers.get("user-id");

    if (!name) {
      return Response.json(
        { error: "Brand name is required" },
        { status: 400 }
      );
    }

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
    const userId = request.headers.get("user-id");

    await connectToDB();

    const query = userId ? { user: userId } : {};
    const brands = await Brand.find(query);

    return Response.json(brands);
  } catch (error) {
    console.error("Error fetching brands:", error);
    return Response.json({ error: "Error fetching brands" }, { status: 500 });
  }
}
