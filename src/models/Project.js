import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  headerColor: { type: String, default: "blue" },
  user: { type: String },
  sessionId: { type: String },
  isTemporary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Project ||
  mongoose.model("Project", projectSchema);
