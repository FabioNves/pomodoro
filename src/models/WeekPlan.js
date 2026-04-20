import mongoose from "mongoose";

const weekTaskSchema = new mongoose.Schema(
  {
    routineTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoutineTask",
      default: null,
    },
    taskName: { type: String, required: true },
    estimatedTime: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const weekDaySchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    tasks: [weekTaskSchema],
  },
  { _id: false },
);

const weekPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  weekStart: { type: String, required: true },
  projects: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
  ],
  estimatedDailyTime: { type: Number, default: 60 },
  days: {
    type: [weekDaySchema],
    default: () =>
      Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, tasks: [] })),
  },
  user: { type: String },
  sessionId: { type: String },
  isTemporary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.WeekPlan ||
  mongoose.model("WeekPlan", weekPlanSchema);
