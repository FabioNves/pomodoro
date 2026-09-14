import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  // Key of the template the project started from (src/lib/projectTemplates.js),
  // kept for reference only; the milestones are editable afterwards.
  template: { type: String, default: null },
  headerColor: { type: String, default: "blue" },
  // Planned span, shown on the timeline. Both optional.
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  user: { type: String },
  sessionId: { type: String },
  isTemporary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Project ||
  mongoose.model("Project", projectSchema);
