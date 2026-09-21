import { z } from "zod";
import mongoose from "mongoose";
import { connectToDB } from "@/lib/db";
import BusinessPhase from "@/models/BusinessPhase";
import BusinessWorkItem from "@/models/BusinessWorkItem";
import BusinessDependency from "@/models/BusinessDependency";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { LIMITS } from "@/lib/business/phases";
import { loopSteps } from "@/lib/business/blueprint";
import {
  SIGN_IN,
  objectId,
  run,
  apiError,
  assertBusiness,
  businessDto,
  itemDto,
  dependencyDto,
  nextOrder,
  logActivity,
} from "@/lib/business/server";

// An improvement loop is one more pass round the cycle for a single change:
// a step in every phase, Define through Improve, each waiting on the one
// before. Starting one is how a business that has "finished" carries on.

// POST /api/business/loops  { businessId, title, origin? }
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      businessId: objectId,
      title: z.string().trim().min(1, "Say what you want to improve").max(LIMITS.loopTitle),
      origin: objectId.optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST business loop", async () => {
    await connectToDB();
    const business = await assertBusiness(auth.userId, body.data.businessId);
    const steps = loopSteps(body.data.title);
    if (business.loops.length >= LIMITS.loops) throw apiError(400, `A business can keep up to ${LIMITS.loops} improvement loops.`);
    const count = await BusinessWorkItem.countDocuments({ business: business._id });
    if (count + steps.length > LIMITS.items) throw apiError(400, `A business can hold up to ${LIMITS.items} work items.`);

    let origin = null;
    if (body.data.origin) {
      origin = await BusinessWorkItem.findOne({ _id: body.data.origin, business: business._id }).select("_id");
      if (!origin) throw apiError(400, "That work item does not belong to this business");
    }
    const phases = await BusinessPhase.find({ business: business._id });
    const phaseIdByKey = new Map(phases.map((phase) => [phase.key, phase._id]));
    if (steps.some((step) => !phaseIdByKey.has(step.phase))) throw apiError(400, "This business is missing a phase");

    const loopId = new mongoose.Types.ObjectId();
    const number = (business.cycle || 1) + 1;
    try {
      const orders = await Promise.all(steps.map((step) => nextOrder(business._id, step.phase)));
      const items = await BusinessWorkItem.insertMany(
        steps.map((step, index) => ({
          user: auth.userId,
          business: business._id,
          phase: phaseIdByKey.get(step.phase),
          phaseKey: step.phase,
          area: step.area,
          title: step.title,
          description: step.description,
          order: orders[index],
          loop: loopId,
        })),
      );
      const edges = await BusinessDependency.insertMany(
        items.slice(1).map((item, index) => ({
          user: auth.userId,
          business: business._id,
          item: item._id,
          dependsOn: items[index]._id,
        })),
      );
      business.loops.push({ _id: loopId, title: body.data.title, number, origin: origin?._id || null });
      business.cycle = number;
      await business.save();

      const activity = await logActivity(business, [
        { type: "loop_started", title: `Started improvement loop ${number}: ${body.data.title}`, phaseKey: "define", item: items[0]._id },
      ]);
      return Response.json(
        { business: businessDto(business), items: items.map(itemDto), dependencies: edges.map(dependencyDto), activity },
        { status: 201 },
      );
    } catch (error) {
      // No half-made loops: take back whatever was created for it.
      const made = await BusinessWorkItem.find({ business: business._id, loop: loopId }).select("_id").catch(() => []);
      const ids = made.map((item) => item._id);
      await BusinessDependency.deleteMany({ $or: [{ item: { $in: ids } }, { dependsOn: { $in: ids } }] }).catch(() => {});
      await BusinessWorkItem.deleteMany({ _id: { $in: ids } }).catch(() => {});
      throw error;
    }
  });
}

// DELETE /api/business/loops  { businessId, loopId }
// Removes the loop with its steps, done or not.
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ businessId: objectId, loopId: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE business loop", async () => {
    await connectToDB();
    const business = await assertBusiness(auth.userId, body.data.businessId);
    const loop = business.loops.id(body.data.loopId);
    if (!loop) throw apiError(404, "Improvement loop not found");

    const items = await BusinessWorkItem.find({ business: business._id, loop: loop._id }).select("_id");
    const ids = items.map((item) => item._id);
    await BusinessDependency.deleteMany({ $or: [{ item: { $in: ids } }, { dependsOn: { $in: ids } }] });
    await BusinessWorkItem.deleteMany({ _id: { $in: ids } });

    const title = loop.title;
    business.loops.pull(loop._id);
    // The cycle is the latest pass still on record, the setup being the first.
    business.cycle = Math.max(1, ...business.loops.map((l) => l.number));
    await business.save();

    const activity = await logActivity(business, [{ type: "loop_removed", title: `Removed improvement loop: ${title}`, phaseKey: "improve" }]);
    return Response.json({ business: businessDto(business), deletedItemIds: ids.map(String), activity });
  });
}
