import mongoose from "mongoose";

// A business the user is creating and running. It owns six BusinessPhase
// documents, the BusinessWorkItem documents under them, the
// BusinessDependency edges between those items, its BusinessMetric numbers
// and a BusinessActivity log. Progress is never stored here: it is derived
// from the work items (src/lib/business/engine.js).
//
// `loops` are the improvement loops: each one is a pass round the cycle
// (Define → … → Improve) for a single change, made of one work item per
// phase that carries the loop's id. `cycle` counts the passes started,
// the initial setup being the first.

const loopSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    number: { type: Number, required: true },
    // The work item that prompted the loop, when it was started from one.
    origin: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessWorkItem", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const businessSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Key of BUSINESS_TYPES in src/lib/business/phases.js.
    type: { type: String, default: "other" },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    currency: { type: String, default: "EUR" },
    cycle: { type: Number, default: 1 },
    loops: { type: [loopSchema], default: [] },
  },
  { timestamps: true },
);

businessSchema.index({ user: 1, createdAt: 1 });

export default mongoose.models.Business || mongoose.model("Business", businessSchema);
