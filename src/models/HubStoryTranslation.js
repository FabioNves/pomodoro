import mongoose from "mongoose";

// A news hub story translated into one language, made the first time a
// reader asks and shared by every reader after (src/lib/news/hubStories.js).
// Expires with the hub's own stories; saved stories keep their own copy.
const hubStoryTranslationSchema = new mongoose.Schema(
  {
    story: { type: String, required: true },
    language: { type: String, required: true },
    headline: { type: String, default: "" },
    summary: { type: String, default: "" },
    whyItMatters: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

hubStoryTranslationSchema.index({ story: 1, language: 1 }, { unique: true });
hubStoryTranslationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.HubStoryTranslation ||
  mongoose.model("HubStoryTranslation", hubStoryTranslationSchema);
