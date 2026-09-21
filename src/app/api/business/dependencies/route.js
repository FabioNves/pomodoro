import { z } from "zod";
import { connectToDB } from "@/lib/db";
import BusinessWorkItem from "@/models/BusinessWorkItem";
import BusinessDependency from "@/models/BusinessDependency";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { LIMITS } from "@/lib/business/phases";
import { buildGraph, wouldCreateCycle } from "@/lib/business/engine";
import {
  SIGN_IN,
  objectId,
  run,
  apiError,
  assertBusiness,
  assertItem,
  dependencyDto,
  logActivity,
} from "@/lib/business/server";

// POST /api/business/dependencies  { item, dependsOn }
// "item cannot start before dependsOn is completed." Both must belong to the
// same business, and the edge must not close a loop. Adding one that already
// exists answers with it rather than failing.
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ item: objectId, dependsOn: objectId }));
  if (!body.ok) return body.response;

  return run("POST business dependency", async () => {
    await connectToDB();
    if (body.data.item === body.data.dependsOn) throw apiError(400, "A work item cannot wait on itself");
    const [item, prerequisite] = await Promise.all([
      assertItem(auth.userId, body.data.item),
      assertItem(auth.userId, body.data.dependsOn),
    ]);
    if (String(item.business) !== String(prerequisite.business)) {
      throw apiError(400, "Both work items must belong to the same business");
    }
    const business = await assertBusiness(auth.userId, item.business);

    const existing = await BusinessDependency.findOne({ item: item._id, dependsOn: prerequisite._id });
    if (existing) return Response.json({ dependency: dependencyDto(existing), activity: [] });

    const [ids, edges] = await Promise.all([
      BusinessWorkItem.find({ business: business._id }).select("_id"),
      BusinessDependency.find({ business: business._id }).select("item dependsOn"),
    ]);
    if (edges.filter((edge) => String(edge.item) === String(item._id)).length >= LIMITS.dependenciesPerItem) {
      throw apiError(400, `A work item can wait on up to ${LIMITS.dependenciesPerItem} others.`);
    }
    const graph = buildGraph(
      ids.map((doc) => ({ id: String(doc._id) })),
      edges.map((edge) => ({ item: String(edge.item), dependsOn: String(edge.dependsOn) })),
    );
    if (wouldCreateCycle(String(item._id), String(prerequisite._id), graph)) {
      throw apiError(409, `"${prerequisite.title}" already waits on "${item.title}", so this would go round in a circle.`, {
        code: "cycle",
      });
    }

    let dependency;
    try {
      dependency = await BusinessDependency.create({
        user: auth.userId,
        business: business._id,
        item: item._id,
        dependsOn: prerequisite._id,
      });
    } catch (error) {
      // Two identical requests raced; the unique index kept one of them.
      if (error?.code !== 11000) throw error;
      dependency = await BusinessDependency.findOne({ item: item._id, dependsOn: prerequisite._id });
    }
    const activity = await logActivity(business, [
      {
        type: "dependency_added",
        title: `"${item.title}" now waits on "${prerequisite.title}"`,
        phaseKey: item.phaseKey,
        item: item._id,
      },
    ]);
    return Response.json({ dependency: dependencyDto(dependency), activity }, { status: 201 });
  });
}

// DELETE /api/business/dependencies  { id }
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE business dependency", async () => {
    await connectToDB();
    const dependency = await BusinessDependency.findOne({ _id: body.data.id, user: auth.userId });
    if (!dependency) throw apiError(404, "Dependency not found");
    const business = await assertBusiness(auth.userId, dependency.business);
    const [item, prerequisite] = await Promise.all([
      BusinessWorkItem.findById(dependency.item).select("title phaseKey"),
      BusinessWorkItem.findById(dependency.dependsOn).select("title"),
    ]);
    await dependency.deleteOne();
    const activity =
      item && prerequisite
        ? await logActivity(business, [
            {
              type: "dependency_removed",
              title: `"${item.title}" no longer waits on "${prerequisite.title}"`,
              phaseKey: item.phaseKey,
              item: item._id,
            },
          ])
        : [];
    return Response.json({ deletedId: String(dependency._id), activity });
  });
}
