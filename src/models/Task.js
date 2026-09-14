import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
  },
  milestone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProjectMilestone",
    default: null,
  },
  order: { type: Number, default: 0 },
  scheduledForLater: { type: Boolean, default: false },
  scheduledDate: { type: Date, default: null },
  // Planned span, shown on the timeline (scheduledDate stays the day the
  // task is placed on in the week plan). Both optional.
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  user: { type: String },
  sessionId: { type: String },
  isTemporary: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  parentTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Task || mongoose.model("Task", taskSchema);
