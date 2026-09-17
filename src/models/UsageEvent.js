import mongoose from "mongoose";

// One row per API request the app served and per external call it made
// (OpenAI, the MCP servers). The admin Usage tab aggregates these by day,
// feature and provider. Rows expire after six months.
//
//   kind "request"  - a GET carrying a user's identity
//   kind "action"   - any other verb (something was created or changed)
//   kind "external" - a paid call to a provider, with its estimated cost
const usageEventSchema = new mongoose.Schema(
  {
    user: { type: String, default: null, index: true },
    kind: { type: String, enum: ["request", "action", "external"], required: true },
    feature: { type: String, default: "other" },
    method: { type: String, default: "" },
    path: { type: String, default: "" },
    provider: { type: String, default: "" },
    model: { type: String, default: "" },
    calls: { type: Number, default: 1 },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    ok: { type: Boolean, default: true },
    at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

usageEventSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
usageEventSchema.index({ kind: 1, at: 1 });

export default mongoose.models.UsageEvent || mongoose.model("UsageEvent", usageEventSchema);
