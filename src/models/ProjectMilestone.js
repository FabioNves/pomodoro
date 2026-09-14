import mongoose from "mongoose";

// A milestone inside a planner project (not the timer's session label, which
// is the older `Milestone` model). Tasks point at one through `Task.milestone`.
// Progress is never stored: it is derived from the tasks assigned to it (see
// src/lib/milestones.js) so it can never drift.

export const MILESTONE_STATUS_VALUES = [
  "planned",
  "active",
  "on_hold",
  "completed",
];

const projectMilestoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    index: true,
  },
  order: { type: Number, default: 0 },
  status: {
    type: String,
    enum: MILESTONE_STATUS_VALUES,
    default: "planned",
  },
  // Planned span. `endDate` is the due date; both optional.
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  user: { type: String },
  sessionId: { type: String },
  isTemporary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.ProjectMilestone ||
  mongoose.model("ProjectMilestone", projectMilestoneSchema);
