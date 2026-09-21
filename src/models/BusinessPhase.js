import mongoose from "mongoose";

// One of the six phases of a business (define, build, launch, operate,
// measure, improve), created with the business. The name and description
// start as a copy of src/lib/business/phases.js so a business can grow its
// own wording later. `weight` is this phase's share of the overall progress;
// its own progress and status are derived from its work items, never stored.

const businessPhaseSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    key: { type: String, required: true },
    order: { type: Number, default: 0 },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    weight: { type: Number, default: 1, min: 0 },
  },
  { timestamps: true },
);

businessPhaseSchema.index({ business: 1, key: 1 }, { unique: true });

export default mongoose.models.BusinessPhase || mongoose.model("BusinessPhase", businessPhaseSchema);
