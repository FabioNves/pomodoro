import { z } from "zod";
import { connectToDB } from "@/lib/db";
import BusinessMetric from "@/models/BusinessMetric";
import { requireUser } from "@/lib/sessionAuth";
import { validateJsonBody } from "@/utils/apiValidation";
import { LIMITS } from "@/lib/business/phases";
import { METRIC_KIND_KEYS, formatMetric } from "@/lib/business/metrics";
import {
  SIGN_IN,
  objectId,
  run,
  apiError,
  assertBusiness,
  metricDto,
  logActivity,
} from "@/lib/business/server";

const label = z.string().trim().min(1, "Give the metric a name").max(LIMITS.metricLabel);
const hint = z.string().trim().max(60);
// A figure, or null to clear it.
const figure = z.number().finite().min(-1e12).max(1e12).nullable();

function slug(text) {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "metric"
  );
}

// POST /api/business/metrics  { businessId, label, kind, hint?, value?, target?, pinned? }
export async function POST(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      businessId: objectId,
      label,
      kind: z.enum(METRIC_KIND_KEYS),
      hint: hint.optional(),
      value: figure.optional(),
      target: figure.optional(),
      pinned: z.boolean().optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("POST business metric", async () => {
    await connectToDB();
    const business = await assertBusiness(auth.userId, body.data.businessId);
    const existing = await BusinessMetric.find({ business: business._id }).select("key order");
    if (existing.length >= LIMITS.metrics) throw apiError(400, `A business can track up to ${LIMITS.metrics} metrics.`);

    const taken = new Set(existing.map((m) => m.key));
    const base = slug(body.data.label);
    let key = base;
    for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;

    const value = body.data.value ?? null;
    const metric = await BusinessMetric.create({
      user: auth.userId,
      business: business._id,
      key,
      label: body.data.label,
      kind: body.data.kind,
      hint: body.data.hint || "",
      value,
      target: body.data.target ?? null,
      pinned: body.data.pinned ?? false,
      order: existing.reduce((max, m) => Math.max(max, m.order ?? 0), -1) + 1,
      history: value === null ? [] : [{ value, at: new Date() }],
    });
    return Response.json({ metric: metricDto(metric), activity: [] }, { status: 201 });
  });
}

// PATCH /api/business/metrics  { id, value?, target?, label?, hint?, pinned? }
// A new value is also appended to the metric's history.
export async function PATCH(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(
    req,
    z.object({
      id: objectId,
      value: figure.optional(),
      target: figure.optional(),
      label: label.optional(),
      hint: hint.optional(),
      pinned: z.boolean().optional(),
    }),
  );
  if (!body.ok) return body.response;

  return run("PATCH business metric", async () => {
    await connectToDB();
    const metric = await BusinessMetric.findOne({ _id: body.data.id, user: auth.userId });
    if (!metric) throw apiError(404, "Metric not found");
    const business = await assertBusiness(auth.userId, metric.business);
    const { value, target, pinned } = body.data;

    const changed = value !== undefined && value !== (metric.value ?? null);
    if (changed) {
      metric.value = value;
      if (value !== null) {
        metric.history.push({ value, at: new Date() });
        if (metric.history.length > LIMITS.metricHistory) {
          metric.history.splice(0, metric.history.length - LIMITS.metricHistory);
        }
      }
    }
    if (target !== undefined) metric.target = target;
    if (body.data.label !== undefined) metric.label = body.data.label;
    if (body.data.hint !== undefined) metric.hint = body.data.hint;
    if (pinned !== undefined) metric.pinned = pinned;
    await metric.save();

    const activity =
      changed && value !== null
        ? await logActivity(business, [
            {
              type: "metric_updated",
              title: `${metric.label} is now ${formatMetric(value, metric.kind, business.currency)}`,
              phaseKey: "measure",
            },
          ])
        : [];
    return Response.json({ metric: metricDto(metric), activity });
  });
}

// DELETE /api/business/metrics  { id }
export async function DELETE(req) {
  const auth = await requireUser(req, SIGN_IN);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, z.object({ id: objectId }));
  if (!body.ok) return body.response;

  return run("DELETE business metric", async () => {
    await connectToDB();
    const metric = await BusinessMetric.findOne({ _id: body.data.id, user: auth.userId });
    if (!metric) throw apiError(404, "Metric not found");
    await metric.deleteOne();
    return Response.json({ deletedId: String(metric._id) });
  });
}
