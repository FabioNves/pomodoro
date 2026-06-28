import mongoose from "mongoose";

const habitSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  color: { type: String, default: "blue" },
  levels: {
    type: [
      {
        label: { type: String, required: true },
        value: { type: Number, required: true },
        // Optional per-level color. When set, the level renders with this
        // palette color + shade instead of the auto-derived shade of the
        // habit color. Legacy levels omit these and keep auto-shading.
        color: { type: String },
        shade: { type: Number },
      },
    ],
    default: [],
  },
  user: { type: String },
  sessionId: { type: String },
  isTemporary: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  inverted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Habit || mongoose.model("Habit", habitSchema);
