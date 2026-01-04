import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
  },
  order: { type: Number, default: 0 },
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
