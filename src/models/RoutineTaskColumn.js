import mongoose from "mongoose";

const routineTaskColumnSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
  },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ["text", "dropdown", "number", "date"],
    required: true,
  },
  options: [{ type: String }],
  colorRules: [
    {
      value: { type: String },
      color: { type: String },
    },
  ],
  order: { type: Number, default: 0 },
  user: { type: String },
  sessionId: { type: String },
  isTemporary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.RoutineTaskColumn ||
  mongoose.model("RoutineTaskColumn", routineTaskColumnSchema);
