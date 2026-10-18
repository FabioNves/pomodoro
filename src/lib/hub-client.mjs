/**
 * Movez Hub client, plain-JavaScript build of hub-client.ts for apps without
 * TypeScript (Express etc.). Same API and env; only dependency: `jose`.
 *
 * Env: HUB_ISSUER, HUB_AUDIENCE, optional HUB_JWKS_URL. See README.md.
 */
import { createRemoteJWKSet, jwtVerify } from "jose";

let jwks = null;

function hubConfig() {
  const issuer = process.env.HUB_ISSUER?.trim().replace(/\/$/, "");
  const audience = process.env.HUB_AUDIENCE?.trim();
  if (!issuer || !audience) throw new Error("HUB_ISSUER and HUB_AUDIENCE must be set.");
  const jwksUrl = process.env.HUB_JWKS_URL ?? `${issuer}/.well-known/jwks.json`;
  jwks ??= createRemoteJWKSet(new URL(jwksUrl), { cooldownDuration: 30_000 });
  return { issuer, audience, jwks };
}

export function hubConfigured() {
  return !!(process.env.HUB_ISSUER && process.env.HUB_AUDIENCE);
}

export class HubTokenError extends Error {}

/**
 * Verifies a hub token (EdDSA signature, issuer, this app's audience, expiry,
 * type). SSO tokens are single-use: `consumeJti(jti, expiresAt)` must return
 * true only the first time it sees a jti.
 */
export async function verifyHubToken(token, typ, consumeJti) {
  const { issuer, audience, jwks } = hubConfig();
  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      algorithms: ["EdDSA"],
      maxTokenAge: typ === "sso" ? "2m" : "6m",
      clockTolerance: 5,
    }));
  } catch {
    throw new HubTokenError("Invalid or expired hub token");
  }
  if (payload.typ !== typ || !payload.sub || !payload.jti || !payload.exp) {
    throw new HubTokenError("Wrong hub token type");
  }
  if (typ === "sso") {
    if (!consumeJti) throw new Error("consumeJti is required for SSO tokens");
    if (!(await consumeJti(payload.jti, new Date(payload.exp * 1000)))) {
      throw new HubTokenError("Hub token already used");
    }
  }
  return payload;
}

/** The verified hub service token from an `Authorization: Bearer` header, or null. */
export async function verifyHubServiceToken(authorizationHeader) {
  const header = authorizationHeader ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !hubConfigured()) return null;
  try {
    return await verifyHubToken(token, "svc");
  } catch {
    return null;
  }
}

/** Only same-site relative paths, so `next` can't redirect off-site. */
export function safeNextPath(next, fallback = "/") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : fallback;
}
