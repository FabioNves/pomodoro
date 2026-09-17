// Server-side token helpers shared by the auth routes.

import jwt from "jsonwebtoken";
import User from "@/models/User";

const SESSION_TTL = "7d";
const HANDOFF_TTL = "2m";
const HANDOFF_PURPOSE = "native-handoff";
// Marks a token as a real sign-in session. Routes that need a trustworthy
// identity (see src/lib/news/auth.js) require this claim, so a token minted
// anywhere else with the same secret is not accepted as a session.
export const SESSION_PURPOSE = "session";

/** The user shape every sign-in response returns. */
export function publicUser(user) {
  return {
    _id: user._id.toString(),
    userId: user._id.toString(),
    googleSub: user.googleSub || null,
    email: user.email,
    name: user.name,
    imageUrl: user.imageUrl,
  };
}

/** The bearer token the clients store as accessToken. */
export function issueSessionToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      name: user.name,
      purpose: SESSION_PURPOSE,
    },
    process.env.JWT_SECRET,
    { expiresIn: SESSION_TTL }
  );
}

/**
 * Native sign-in happens in the system browser on the website, which then
 * sends the app a deep link. Only this short-lived code travels in that link;
 * the app exchanges it for a session token over HTTPS.
 */
export function issueHandoffCode(user) {
  return jwt.sign(
    { userId: user._id, purpose: HANDOFF_PURPOSE },
    process.env.JWT_SECRET,
    { expiresIn: HANDOFF_TTL }
  );
}

/** Returns the userId for a valid handoff code, or null. */
export function verifyHandoffCode(code) {
  try {
    const payload = jwt.verify(code, process.env.JWT_SECRET);
    return payload?.purpose === HANDOFF_PURPOSE && payload.userId
      ? payload.userId
      : null;
  } catch {
    return null;
  }
}

/**
 * Record a sign-in. Also clears a session revocation: tokens issued from
 * now on carry a later iat than sessionsRevokedAt and pass the check in
 * src/lib/sessionAuth.js, so the timestamp only needs to stay for history.
 */
export async function markSignedIn(userId) {
  const now = new Date();
  await User.updateOne({ _id: userId }, { $set: { lastSignInAt: now, lastActiveAt: now } });
}
