import mongoose from "mongoose";

const habitEntrySchema = new mongoose.Schema({
  habit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Habit",
    required: true,
  },
  date: { type: String, required: true }, // "YYYY-MM-DD"
  level: { type: Number, default: 0 },
  user: { type: String },
  sessionId: { type: String },
  isTemporary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

habitEntrySchema.index({ habit: 1, date: 1 }, { unique: true });

export default mongoose.models.HabitEntry ||
  mongoose.model("HabitEntry", habitEntrySchema);
