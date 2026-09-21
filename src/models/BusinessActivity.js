import mongoose from "mongoose";

// What happened in a business, newest first on the overview: work started,
// completed or reopened, prerequisites rewired, numbers updated, loops
// started. Written by the routes (logActivity in src/lib/business/server.js),
// never by the browser. It is a log, not a source of truth, so rows expire
// after a year and nothing reads state back out of them.

export const ACTIVITY_TYPES = [
  "business_created",
  "business_updated",
  "item_added",
  "item_started",
  "item_completed",
  "item_reopened",
  "item_removed",
  "dependency_added",
  "dependency_removed",
  "metric_updated",
  "loop_started",
  "loop_removed",
];

const businessActivitySchema = new mongoose.Schema({
  user: { type: String, required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
  type: { type: String, enum: ACTIVITY_TYPES, required: true },
  // The sentence the overview shows, written when it happened.
  title: { type: String, required: true, maxlength: 300 },
  phaseKey: { type: String, default: null },
  item: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 365 },
});

businessActivitySchema.index({ business: 1, createdAt: -1 });

export default mongoose.models.BusinessActivity || mongoose.model("BusinessActivity", businessActivitySchema);
