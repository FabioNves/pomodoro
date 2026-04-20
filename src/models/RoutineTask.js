import mongoose from "mongoose";

const routineTaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
  },
  frequency: {
    type: String,
    enum: [
      "daily",
      "weekly",
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
      "custom",
    ],
    default: "daily",
  },
  frequencyCustom: { type: String, default: "" },
  estimatedTime: { type: Number, default: 0 },
  notes: { type: String, default: "" },
  color: { type: String, default: "" },
  customFields: [
    {
      column: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RoutineTaskColumn",
      },
      value: { type: mongoose.Schema.Types.Mixed },
    },
  ],
  order: { type: Number, default: 0 },
  user: { type: String },
  sessionId: { type: String },
  isTemporary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.RoutineTask ||
  mongoose.model("RoutineTask", routineTaskSchema);
