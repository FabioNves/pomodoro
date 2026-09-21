import { z } from "zod";
import { connectToDB } from "@/lib/db";
import Business from "@/models/Business";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody, validateSearchParams } from "@/utils/apiValidation";
import { LIMITS, businessTypeMeta } from "@/lib/business/phases";
import {
  SIGN_IN,
  objectId,
  businessName,
  businessType,
  businessCurrency,
  descriptionText,
  run,
  apiError,
  assertBusiness,
  businessDto,
  loadSnapshot,
  seedBusiness,
  deleteBusinessData,
  logActivity,
} from "@/lib/business/server";

// GET /api/business[?business=<id>]
// The user's businesses and everything about the one being shown: phases,
// work items, dependencies, metrics and recent activity. With no business
// yet, `business` is null and the page offers to create one.
export async function GET(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const query = validateSearchParams(req, z.object({ business: objectId.optional() }));
  if (!query.ok) return query.response;

  return run("GET business", async () => {
    await connectToDB();
    return Response.json(await loadSnapshot(auth.userId, query.data.business || null));
  });
}

// POST /api/business  { name, type, description?, currency? }
// Creates the business and generates its structure: the six phases, the work
// items its type starts with, the prerequisites between them and the default
// metrics. Answers with the same snapshot GET returns.
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      name: businessName,
      type: businessType,
      description: descriptionText.optional(),
      currency: businessCurrency.optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST business", async () => {
    await connectToDB();
    const count = await Business.countDocuments({ user: auth.userId });
    if (count >= LIMITS.businesses) {
      throw apiError(400, `You can keep up to ${LIMITS.businesses} businesses. Delete one to add another.`);
    }
    const business = await Business.create({
      user: auth.userId,
      name: body.data.name,
      type: body.data.type,
      description: body.data.description || "",
      currency: body.data.currency || "EUR",
    });
    try {
      await seedBusiness(business);
    } catch (error) {
      // Half a structure is worse than none: take it all back.
      await deleteBusinessData(business._id).catch(() => {});
      throw error;
    }
    await logActivity(business, [
      {
        type: "business_created",
        title: `Created ${business.name} (${businessTypeMeta(business.type).label.toLowerCase()})`,
        phaseKey: "define",
      },
    ]);
    return Response.json(await loadSnapshot(auth.userId, String(business._id)), { status: 201 });
  });
}

// PATCH /api/business  { id, name?, description?, currency? }
// The type is not editable: it only decided what the business started with.
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      id: objectId,
      name: businessName.optional(),
      description: descriptionText.optional(),
      currency: businessCurrency.optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("PATCH business", async () => {
    await connectToDB();
    const { id, name, description, currency } = body.data;
    const business = await assertBusiness(auth.userId, id);
    const renamed = name !== undefined && name !== business.name;
    if (name !== undefined) business.name = name;
    if (description !== undefined) business.description = description;
    if (currency !== undefined) business.currency = currency;
    await business.save();
    const activity = renamed
      ? await logActivity(business, [{ type: "business_updated", title: `Renamed the business to ${business.name}` }])
      : [];
    return Response.json({ business: businessDto(business), activity });
  });
}

// DELETE /api/business  { id }
// Deletes the business with its phases, work items, dependencies, metrics
// and activity.
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE business", async () => {
    await connectToDB();
    const business = await assertBusiness(auth.userId, body.data.id);
    await deleteBusinessData(business._id);
    return Response.json({ deletedId: String(business._id) });
  });
}
