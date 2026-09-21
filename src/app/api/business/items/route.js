import { z } from "zod";
import { connectToDB } from "@/lib/db";
import BusinessPhase from "@/models/BusinessPhase";
import BusinessWorkItem from "@/models/BusinessWorkItem";
import BusinessDependency from "@/models/BusinessDependency";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { LIMITS, STORED_STATUSES, phaseMeta } from "@/lib/business/phases";
import {
  SIGN_IN,
  objectId,
  phaseKey,
  itemTitle,
  areaName,
  descriptionText,
  run,
  apiError,
  assertBusiness,
  assertItem,
  itemDto,
  dependencyDto,
  blockersFor,
  nextOrder,
  logActivity,
} from "@/lib/business/server";

// POST /api/business/items  { businessId, phase, area, title, description?, dependsOn?: [id] }
// Adds a work item at the end of its phase, optionally waiting on others.
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      businessId: objectId,
      phase: phaseKey,
      area: areaName,
      title: itemTitle,
      description: descriptionText.optional(),
      dependsOn: z.array(objectId).max(LIMITS.dependenciesPerItem).optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST business item", async () => {
    await connectToDB();
    const { businessId, phase, area, title, description, dependsOn = [] } = body.data;
    const business = await assertBusiness(auth.userId, businessId);
    const [count, phaseDoc] = await Promise.all([
      BusinessWorkItem.countDocuments({ business: business._id }),
      BusinessPhase.findOne({ business: business._id, key: phase }),
    ]);
    if (count >= LIMITS.items) throw apiError(400, `A business can hold up to ${LIMITS.items} work items.`);
    if (!phaseDoc) throw apiError(400, "That phase does not exist in this business");

    const prerequisiteIds = [...new Set(dependsOn)];
    if (prerequisiteIds.length) {
      const found = await BusinessWorkItem.countDocuments({ _id: { $in: prerequisiteIds }, business: business._id });
      if (found !== prerequisiteIds.length) throw apiError(400, "A prerequisite does not belong to this business");
    }

    const item = await BusinessWorkItem.create({
      user: auth.userId,
      business: business._id,
      phase: phaseDoc._id,
      phaseKey: phase,
      area,
      title,
      description: description || "",
      order: await nextOrder(business._id, phase),
    });
    // A new item has nothing waiting on it, so these edges cannot close a loop.
    const edges = prerequisiteIds.length
      ? await BusinessDependency.insertMany(
          prerequisiteIds.map((id) => ({ user: auth.userId, business: business._id, item: item._id, dependsOn: id })),
        )
      : [];
    const activity = await logActivity(business, [
      { type: "item_added", title: `Added "${item.title}" to ${phaseMeta(phase).name}`, phaseKey: phase, item: item._id },
    ]);
    return Response.json({ item: itemDto(item), dependencies: edges.map(dependencyDto), activity }, { status: 201 });
  });
}

// PATCH /api/business/items  { id, title?, description?, notes?, area?, status? }
// A status change to "in_progress" or "completed" is refused with 409
// { code: "blocked", blockers } while a prerequisite is not completed.
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      id: objectId,
      title: itemTitle.optional(),
      description: descriptionText.optional(),
      notes: z.string().max(LIMITS.notes).optional(),
      area: areaName.optional(),
      status: z.enum(STORED_STATUSES).optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("PATCH business item", async () => {
    await connectToDB();
    const { id, title, description, notes, area, status } = body.data;
    const item = await assertItem(auth.userId, id);
    const entries = [];

    if (status !== undefined && status !== item.status) {
      if (status !== "not_started") {
        const blockers = await blockersFor(item);
        if (blockers.length) {
          throw apiError(409, `Blocked by: ${blockers.map((b) => b.title).join(", ")}`, { code: "blocked", blockers });
        }
      }
      const wasCompleted = item.status === "completed";
      const now = new Date();
      item.status = status;
      if (status === "not_started") {
        item.startedAt = null;
        item.completedAt = null;
      } else {
        item.startedAt = item.startedAt || now;
        item.completedAt = status === "completed" ? now : null;
      }
      const type = status === "completed" ? "item_completed" : wasCompleted ? "item_reopened" : status === "in_progress" ? "item_started" : null;
      const verb = { item_completed: "Completed", item_reopened: "Reopened", item_started: "Started" }[type];
      if (type) entries.push({ type, title: `${verb} "${title ?? item.title}"`, phaseKey: item.phaseKey, item: item._id });
    }
    if (title !== undefined) item.title = title;
    if (description !== undefined) item.description = description;
    if (notes !== undefined) item.notes = notes;
    if (area !== undefined) item.area = area;
    await item.save();

    const activity = entries.length ? await logActivity(await assertBusiness(auth.userId, item.business), entries) : [];
    return Response.json({ item: itemDto(item), activity });
  });
}

// DELETE /api/business/items  { id }
// Removes the item and the dependencies on both sides of it, so whatever
// was waiting on it is no longer held back by it.
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE business item", async () => {
    await connectToDB();
    const item = await assertItem(auth.userId, body.data.id);
    const business = await assertBusiness(auth.userId, item.business);
    await BusinessDependency.deleteMany({ $or: [{ item: item._id }, { dependsOn: item._id }] });
    await item.deleteOne();
    const activity = await logActivity(business, [
      { type: "item_removed", title: `Removed "${item.title}" from ${phaseMeta(item.phaseKey)?.name || "the business"}`, phaseKey: item.phaseKey },
    ]);
    return Response.json({ deletedId: String(item._id), activity });
  });
}
