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
      "monthly",
    ],
    default: "daily",
  },
  frequencies: { type: [String], default: [] },
  // Monthly patterns (see src/lib/routineSchedule.js): first Monday of the
  // month, first week of the month, the 15th, the last day, …
  monthly: {
    type: [
      new mongoose.Schema(
        {
          type: { type: String, enum: ["weekday", "week", "day"], required: true },
          nth: { type: Number },
          weekday: { type: String },
          day: { type: Number },
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  autoSchedule: { type: Boolean, default: false },
  frequencyCustom: { type: String, default: "" },
  // Time of day the task is meant to happen (minutes after midnight); null
  // means "any time" and the calendar shows it without a fixed hour.
  startMinute: { type: Number, default: null },
  // The routine is only active between these dates ("YYYY-MM-DD", either may
  // be empty).
  startDate: { type: String, default: "" },
  endDate: { type: String, default: "" },
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
