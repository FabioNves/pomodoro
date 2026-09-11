import mongoose from "mongoose";

export const FEEDBACK_VALUES = [
  "relevant",
  "not_relevant",
  "interesting",
  "not_interested",
];

// The user's verdict on a story. One row per (user, story); a new verdict
// replaces the old one. Title, topics and domain are copied so ranking can
// use the feedback without joining back to the story.
const newsFeedbackSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BriefingStory",
      required: true,
    },
    briefing: { type: mongoose.Schema.Types.ObjectId, ref: "Briefing" },
    value: { type: String, enum: FEEDBACK_VALUES, required: true },
    headline: { type: String, default: "" },
    topics: { type: [String], default: [] },
    domain: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  { timestamps: true },
);

newsFeedbackSchema.index({ user: 1, story: 1 }, { unique: true });
newsFeedbackSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.models.NewsFeedback ||
  mongoose.model("NewsFeedback", newsFeedbackSchema);
