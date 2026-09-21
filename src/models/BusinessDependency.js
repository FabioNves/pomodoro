import mongoose from "mongoose";

// "`item` cannot start before `dependsOn` is completed." One document per
// edge, between two work items of the same business (they may sit in
// different phases, which is how a later phase waits for an earlier one).
// The route refuses an edge that would close a loop; deleting a work item
// deletes the edges on both sides of it.

const businessDependencySchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessWorkItem", required: true },
    dependsOn: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessWorkItem", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

businessDependencySchema.index({ item: 1, dependsOn: 1 }, { unique: true });
businessDependencySchema.index({ dependsOn: 1 });

export default mongoose.models.BusinessDependency ||
  mongoose.model("BusinessDependency", businessDependencySchema);
