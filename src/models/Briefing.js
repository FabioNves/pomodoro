import mongoose from "mongoose";

// A grouped item that is not a single story: a weekly "biggest development"
// or a trend backed by several retrieved articles.
const groupedItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 300 },
    summary: { type: String, default: "", maxlength: 2000 },
    sources: [
      {
        _id: false,
        article: { type: mongoose.Schema.Types.ObjectId, ref: "NewsArticle" },
        url: String,
        title: String,
        publisher: String,
        publishedAt: Date,
      },
    ],
  },
  { _id: false },
);

const briefingSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: ["daily", "weekly", "monthly", "custom"],
      required: true,
    },
    status: {
      type: String,
      enum: ["generating", "ready", "empty", "failed"],
      default: "generating",
    },
    trigger: { type: String, enum: ["manual", "scheduled"], default: "manual" },
    // Local calendar date ("2026-09-10") of the delivery cycle in the user's
    // timezone. For weekly briefings it is the delivery day; the briefing
    // covers the seven days ending on it.
    periodKey: { type: String, required: true },
    timezone: { type: String, default: "UTC" },

    title: { type: String, default: "" },
    intro: { type: String, default: "" },
    // Weekly only: the handful of developments that defined the week.
    highlights: { type: [groupedItemSchema], default: [] },
    trends: { type: [groupedItemSchema], default: [] },
    storyCount: { type: Number, default: 0 },
    // Set when the model reported that the retrieved material was too thin.
    note: { type: String, default: "" },

    stats: {
      queries: { type: Number, default: 0 },
      searchesOk: { type: Number, default: 0 },
      searchesFailed: { type: Number, default: 0 },
      resultsRetrieved: { type: Number, default: 0 },
      uniqueArticles: { type: Number, default: 0 },
      pagesFetched: { type: Number, default: 0 },
      candidatesSent: { type: Number, default: 0 },
      storiesDropped: { type: Number, default: 0 },
      model: { type: String, default: "" },
      mcpServer: { type: String, default: "" },
      durationMs: { type: Number, default: 0 },
      warnings: { type: [String], default: [] },
    },
    error: { type: String, default: "" },
    errorCode: { type: String, default: "" },

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

briefingSchema.index({ user: 1, kind: 1, createdAt: -1 });
briefingSchema.index({ user: 1, kind: 1, periodKey: 1, trigger: 1 });
// At most one briefing per user may be generating at a time, enforced by the
// database so two concurrent requests cannot both start one.
briefingSchema.index(
  { user: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "generating" } },
);

export default mongoose.models.Briefing ||
  mongoose.model("Briefing", briefingSchema);
