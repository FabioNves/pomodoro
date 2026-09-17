import { z } from "zod";
import { requireAdmin } from "@/lib/access/admin";
import { loadRegistry, saveRegistry } from "@/lib/access/server";
import {
  BILLING_INTERVALS,
  CURRENCIES,
  FEATURE_KEYS,
  PLAN_STATUSES,
} from "@/lib/access/features";
import { jsonError, validateJsonBody } from "@/utils/apiValidation";

export const dynamic = "force-dynamic";

const featureSchema = z.object({
  key: z.enum(FEATURE_KEYS),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300),
  availableToFree: z.boolean(),
  availableToPremium: z.boolean(),
  enabled: z.boolean(),
});

const planSchema = z.object({
  name: z.string().trim().min(1).max(40),
  tagline: z.string().trim().max(120),
  price: z.number().min(0).max(100000),
  currency: z.enum(CURRENCIES),
  interval: z.enum(BILLING_INTERVALS),
  status: z.enum(PLAN_STATUSES),
  checkoutUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https:\/\//i.test(v), "Must be an https URL")
    .default(""),
});

const registrySchema = z.object({
  features: z.array(featureSchema).max(FEATURE_KEYS.length),
  plans: z.object({ free: planSchema, premium: planSchema }),
});

// GET /api/admin/registry
export async function GET(req) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return Response.json({ registry: await loadRegistry({ fresh: true }) });
  } catch (error) {
    console.error("[admin] registry load failed", error);
    return jsonError(500, "Could not load the feature registry");
  }
}

// PUT /api/admin/registry  { features, plans }
// Replaces the stored registry. What comes back is the normalized result
// that gating, the pricing page and /api/me now use.
export async function PUT(req) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const body = await validateJsonBody(req, registrySchema);
  if (!body.ok) return body.response;
  try {
    const registry = await saveRegistry(body.data, { updatedBy: auth.email });
    return Response.json({ registry });
  } catch (error) {
    console.error("[admin] registry save failed", error);
    return jsonError(500, "Could not save the feature registry");
  }
}
