import mongoose from "mongoose";

const weekTaskSchema = new mongoose.Schema(
  {
    routineTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoutineTask",
      default: null,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    taskName: { type: String, required: true },
    estimatedTime: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    completed: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    // Calendar placement: minutes from midnight (null = no fixed time, shown
    // in the day's "unscheduled" area) and block length in minutes (null =
    // fall back to estimatedTime, then 60).
    startMinute: { type: Number, default: null },
    durationMinutes: { type: Number, default: null },
    // For a task that stands for a cycle occurrence (routineTask set): the
    // day of that occurrence, when the task was moved away from it. null =
    // the day the task sits on. It is what stops a cycle regenerating on the
    // day its task was moved off (see occurrencesHandled in weekPlanView.js).
    originDay: { type: Number, default: null, min: 0, max: 6 },
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
