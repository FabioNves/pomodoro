const mongoose = require("mongoose");

// Roles are not stored as such: admin is the configured admin email or a
// current Movez Hub grant (hubAdminUntil), premium is an unexpired premium
// plan, free is everyone else (see src/lib/access/server.js).
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    imageUrl: { type: String },
    googleSub: { type: String },

    // Subscription. Premium with no expiry never lapses.
    plan: { type: String, enum: ["free", "premium"], default: "free" },
    planExpiresAt: { type: Date, default: null },

    // Admin preview: "premium" or "free" makes the app behave as that role.
    // Ignored for anyone whose real role is not admin.
    viewAs: { type: String, enum: ["premium", "free", null], default: null },

    // Activity, kept by the session checks. lastActiveAt is updated at most
    // once a minute per user; "active" in the admin page means within 15 min.
    lastActiveAt: { type: Date, default: null },
    lastSignInAt: { type: Date, default: null },
    // Session tokens issued before this instant are rejected.
    sessionsRevokedAt: { type: Date, default: null },
    // Admin granted by the Movez Hub: set for 12 h on each "Open admin" from
    // the hub, so access removed in the hub lapses on its own.
    hubAdminUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

// Check if model already exists before creating it
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
