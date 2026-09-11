import mongoose from "mongoose";

// A story the user bookmarked. Key fields are copied so the list still
// renders if the briefing is ever removed.
const savedStorySchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BriefingStory",
      required: true,
    },
    briefing: { type: mongoose.Schema.Types.ObjectId, ref: "Briefing" },
    headline: { type: String, default: "" },
    summary: { type: String, default: "" },
    url: { type: String, default: "" },
    publisher: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
    topics: { type: [String], default: [] },
  },
  { timestamps: true },
);

savedStorySchema.index({ user: 1, story: 1 }, { unique: true });

export default mongoose.models.SavedStory ||
  mongoose.model("SavedStory", savedStorySchema);
