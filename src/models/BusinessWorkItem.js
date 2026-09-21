import mongoose from "mongoose";

// A piece of work inside a phase. Phase progress is the share of these that
// are completed. Only three statuses are stored; "blocked" and "ready" are
// derived from the BusinessDependency edges (src/lib/business/engine.js).
//
// `phaseKey` repeats the key of `phase` (phase keys never change) so the
// lists and the engine need no join. `area` is the section of the phase
// workspace the item sits in, stored as its label so users can make up their
// own. `templateKey` is set on items that came from the blueprint, `loop` on
// the steps of an improvement loop (an id in Business.loops). `link` points
// at a screen of the app that already does the work, and is where a future
// module (CRM, Finance, Inventory…) attaches itself to an item.

export const WORK_ITEM_STATUS_VALUES = ["not_started", "in_progress", "completed"];

const businessWorkItemSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    phase: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessPhase", required: true },
    phaseKey: { type: String, required: true },
    area: { type: String, required: true, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    notes: { type: String, default: "", maxlength: 5000 },
    status: { type: String, enum: WORK_ITEM_STATUS_VALUES, default: "not_started" },
    order: { type: Number, default: 0 },
    weight: { type: Number, default: 1, min: 0 },
    templateKey: { type: String, default: null },
    loop: { type: mongoose.Schema.Types.ObjectId, default: null },
    link: {
      type: new mongoose.Schema(
        { label: { type: String, maxlength: 60 }, href: { type: String, maxlength: 300 } },
        { _id: false },
      ),
      default: null,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

businessWorkItemSchema.index({ business: 1, phaseKey: 1, order: 1 });

export default mongoose.models.BusinessWorkItem || mongoose.model("BusinessWorkItem", businessWorkItemSchema);
