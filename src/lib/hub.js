// Movez Hub sign-in. Server only.
//
// "Open admin" in the hub posts a 60-second, single-use token to
// /api/hub/sso. A valid one becomes a one-time ticket that /auth/hub (in the
// browser) redeems at /api/hub/redeem for a normal session — the same
// accessToken a Google sign-in stores.
//
// Both the hub token id and the ticket are recorded once in
// `hub_sso_tokens`, so neither can be replayed. Rows expire on their own.

import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDB } from "@/lib/db";

const TICKET_MS = 60 * 1000;
/** How long one hub sign-in keeps the admin role (renewed on every hub sign-in). */
export const HUB_ADMIN_MS = 12 * 60 * 60 * 1000;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

let indexed = false;
async function tokens() {
  await connectToDB();
  const collection = mongoose.connection.collection("hub_sso_tokens");
  if (!indexed) {
    await collection.createIndex({ jti: 1 }, { unique: true });
    await collection.createIndex({ ticketHash: 1 });
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    indexed = true;
  }
  return collection;
}

/** Records a hub token id; false if it was seen before (a replay). */
export async function consumeHubJti(jti, expiresAt) {
  try {
    await (await tokens()).insertOne({ jti, expiresAt, ticketHash: null, userId: null, usedAt: null });
    return true;
  } catch (err) {
    if (err?.code === 11000) return false;
    throw err;
  }
}

/** Attaches a fresh one-time ticket for `userId` to the consumed hub token. */
export async function issueHubTicket(jti, userId) {
  const ticket = crypto.randomBytes(32).toString("base64url");
  await (await tokens()).updateOne(
    { jti },
    { $set: { ticketHash: sha256(ticket), userId: String(userId), expiresAt: new Date(Date.now() + TICKET_MS) } },
  );
  return ticket;
}

/** Redeems a ticket once; returns its user id, or null. */
export async function redeemHubTicket(ticket) {
  if (!ticket || typeof ticket !== "string") return null;
  const row = await (await tokens()).findOneAndUpdate(
    { ticketHash: sha256(ticket), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  // The driver returns the document directly (v6) or wrapped in { value } (older).
  const doc = row && "value" in row ? row.value : row;
  return doc?.userId ?? null;
}
