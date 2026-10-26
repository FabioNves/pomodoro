import mongoose from "mongoose";

// A story the user bookmarked. Key fields are copied so the list still
// renders if the briefing is ever removed.
const savedStorySchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    // A briefing story, or a news hub story (its hub id, also an ObjectId).
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BriefingStory",
      required: true,
    },
    hub: { type: Boolean, default: false },
    whyItMatters: { type: String, default: "" },
    sources: {
      type: [new mongoose.Schema({ title: String, url: String, publisher: String }, { _id: false })],
      default: [],
    },
    briefing: { type: mongoose.Schema.Types.ObjectId, ref: "Briefing" },
    headline: { type: String, default: "" },
    summary: { type: String, default: "" },
    url: { type: String, default: "" },
    publisher: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
    topics: { type: [String], default: [] },
    // Copied from the story, so saved stories can be grouped by language.
    language: { type: String, default: "" },
    outputLanguage: { type: String, default: "" },
    countries: { type: [String], default: [] },
  },
  { timestamps: true },
);

savedStorySchema.index({ user: 1, story: 1 }, { unique: true });

export default mongoose.models.SavedStory ||
  mongoose.model("SavedStory", savedStorySchema);
