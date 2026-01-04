import { connectToDB } from "@/lib/db";
import User from "@/models/User";
import { z } from "zod";
import { validateJsonBody } from "@/utils/apiValidation";

const upsertUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  imageUrl: z.string().trim().url().max(2048).optional(),
});

export async function POST(req) {
  try {
    const body = await validateJsonBody(req, upsertUserSchema);
    if (!body.ok) return body.response;

    const { name, email, imageUrl } = body.data;

    await connectToDB(); // Ensure DB connection

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ name, email, imageUrl });
      await user.save();
    }

    // Return the database `_id` along with other user details
    return new Response(
      JSON.stringify({
        _id: user._id,
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Error saving user:", err);
    return new Response(JSON.stringify({ error: "Failed to save user" }), {
      status: 500,
    });
  }
}
