import mongoose from "mongoose";

// One story inside a briefing. Every story points at a retrieved
// NewsArticle; the URL, publisher and date are copied from that article,
// never produced by the model.
const storySourceSchema = new mongoose.Schema(
  {
    article: { type: mongoose.Schema.Types.ObjectId, ref: "NewsArticle" },
    url: { type: String, required: true },
    title: { type: String, default: "" },
    publisher: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
  },
  { _id: false },
);

const briefingStorySchema = new mongoose.Schema(
  {
    briefing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Briefing",
      required: true,
      index: true,
    },
    user: { type: String, required: true, index: true },
    section: {
      type: String,
      enum: ["top", "worthKnowing", "missed"],
      default: "top",
    },
    rank: { type: Number, default: 0 },

    headline: { type: String, required: true, maxlength: 300 },
    summary: { type: String, default: "", maxlength: 3000 },
    whyItMatters: { type: String, default: "", maxlength: 2000 },
    // True when the "why it matters" is the model's analysis rather than
    // something the sources state.
    isAnalysis: { type: Boolean, default: false },
    // User topics this story was matched to (for "follow topic" and for
    // feeding feedback back into ranking).
    topics: { type: [String], default: [] },
    // New topics the reader could follow from this story (not yet followed
    // when the briefing was generated).
    suggestedTopics: { type: [String], default: [] },

    article: { type: mongoose.Schema.Types.ObjectId, ref: "NewsArticle" },
    url: { type: String, required: true },
    publisher: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
    sources: { type: [storySourceSchema], default: [] },

    // The edition of the run this story belongs to (Briefing.editions.key),
    // the language its news was found in, the language it is written in, and
    // the countries that edition covered. Empty on stories from before
    // editions existed.
    edition: { type: String, default: "" },
    language: { type: String, default: "" },
    outputLanguage: { type: String, default: "" },
    countries: { type: [String], default: [] },
  },
  { timestamps: true },
);

briefingStorySchema.index({ briefing: 1, edition: 1, rank: 1 });

export default mongoose.models.BriefingStory ||
  mongoose.model("BriefingStory", briefingStorySchema);
