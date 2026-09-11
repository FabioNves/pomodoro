import mongoose from "mongoose";

// One document per user. Topics live in NewsTopic so they can be followed
// straight from a story; everything else about the briefing lives here.
const scheduleSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    // "HH:MM" in the user's timezone.
    time: { type: String, default: "07:00" },
  },
  { _id: false },
);

const newsPreferenceSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, unique: true, index: true },
    timezone: { type: String, default: "UTC" },

    daily: { type: scheduleSchema, default: () => ({ enabled: true }) },
    weekly: {
      type: new mongoose.Schema(
        {
          enabled: { type: Boolean, default: false },
          // 0 = Sunday … 6 = Saturday (JavaScript convention).
          day: { type: Number, default: 1, min: 0, max: 6 },
          time: { type: String, default: "08:00" },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    monthly: {
      type: new mongoose.Schema(
        {
          enabled: { type: Boolean, default: false },
          // Day of the month, clamped to the last day in shorter months.
          day: { type: Number, default: 1, min: 1, max: 31 },
          time: { type: String, default: "08:00" },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    custom: {
      type: new mongoose.Schema(
        {
          enabled: { type: Boolean, default: false },
          days: { type: [Number], default: [] },
          time: { type: String, default: "07:00" },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Free text, e.g. "Solo developer building a Next.js SaaS; I care about
    // pricing changes and developer tooling more than funding rounds."
    customInterests: { type: String, default: "", maxlength: 1000 },
    storyCount: { type: Number, default: 7, min: 3, max: 15 },
    briefingLength: {
      type: String,
      enum: ["short", "medium", "long"],
      default: "medium",
    },
    majorNewsOnly: { type: Boolean, default: false },
    includeWorthKnowing: { type: Boolean, default: true },

    // Period keys of the last scheduled generation per kind, so the
    // scheduler never produces the same cycle twice.
    lastScheduled: {
      daily: { type: String, default: "" },
      weekly: { type: String, default: "" },
      monthly: { type: String, default: "" },
      custom: { type: String, default: "" },
    },

    // Cheap per-user throttle for the follow-up question endpoint, which
    // spends OpenAI and MCP calls on every request.
    lastAskAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.models.NewsPreference ||
  mongoose.model("NewsPreference", newsPreferenceSchema);
