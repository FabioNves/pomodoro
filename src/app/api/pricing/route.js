import { loadRegistry } from "@/lib/access/server";
import { jsonError } from "@/utils/apiValidation";

export const dynamic = "force-dynamic";

// GET /api/pricing
// Public. The plans and the feature list the pricing page renders, straight
// from the feature registry the admin edits. Features switched off globally
// and plans marked hidden are left out.
export async function GET() {
  try {
    const registry = await loadRegistry();
    return Response.json(
      {
        features: registry.features
          .filter((f) => f.enabled)
          .map((f) => ({
            key: f.key,
            name: f.name,
            description: f.description,
            group: f.group,
            availableToFree: f.availableToFree,
            availableToPremium: f.availableToPremium,
          })),
        plans: Object.values(registry.plans).filter((p) => p.status !== "hidden"),
        updatedAt: registry.updatedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[pricing] could not load the registry", error);
    return jsonError(500, "Could not load pricing");
  }
}
