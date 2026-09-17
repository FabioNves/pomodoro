import { z } from "zod";

function zodIssues(error) {
  if (!(error instanceof z.ZodError)) return undefined;
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function jsonError(status, error, details) {
  return Response.json(
    {
      error,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export async function parseJson(req) {
  try {
    return { ok: true, data: await req.json() };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

export async function validateJsonBody(req, schema) {
  const parsed = await parseJson(req);
  if (!parsed.ok) {
    return { ok: false, response: jsonError(400, parsed.error) };
  }

  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(400, "Invalid request body", zodIssues(result.error)),
    };
  }

  return { ok: true, data: result.data };
}

export function validateSearchParams(req, schema) {
  const { searchParams } = new URL(req.url);
  const obj = Object.fromEntries(searchParams.entries());

  const result = schema.safeParse(obj);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(
        400,
        "Invalid query parameters",
        zodIssues(result.error)
      ),
    };
  }

  return { ok: true, data: result.data };
}

export function validateRouteParams(params, schema) {
  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(
        400,
        "Invalid route parameters",
        zodIssues(result.error)
      ),
    };
  }

  return { ok: true, data: result.data };
}

export const identityHeadersSchema = z
  .object({
    userId: z.string().trim().min(1).max(256).optional(),
    sessionId: z.string().trim().min(1).max(256).optional(),
  })
  .refine((v) => Boolean(v.userId || v.sessionId), {
    message: "Missing user-id or session-id",
    path: ["userId"],
  });

export function getIdentityHeaders(req) {
  return {
    userId: req.headers.get("user-id") ?? undefined,
    sessionId: req.headers.get("session-id") ?? undefined,
  };
}

/**
 * Validate the planner identity headers and check that the identity's plan
 * includes the feature behind the route (src/lib/access/server.js). A
 * locked feature answers 403 with { code: "feature_locked", feature }.
 */
export async function validateIdentityHeaders(req, { feature } = {}) {
  const headers = getIdentityHeaders(req);
  const result = identityHeadersSchema.safeParse(headers);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(401, "Missing user-id or session-id"),
    };
  }

  const { gateIdentity } = await import("@/lib/access/server");
  const denied = await gateIdentity(req, { userId: result.data.userId, features: feature });
  if (denied) return { ok: false, response: denied };

  return { ok: true, data: result.data };
}
