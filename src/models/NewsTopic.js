import mongoose from "mongoose";

// A topic the user follows ("AI agents", "Next.js", "Anthropic", …).
// `key` is the normalised form used for de-duplication.
const newsTopicSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    key: { type: String, required: true },
    // "manual": typed in settings; "story": followed from a briefing story.
    source: { type: String, enum: ["manual", "story"], default: "manual" },
    weight: { type: Number, default: 1, min: 0.1, max: 5 },
  },
  { timestamps: true },
);

newsTopicSchema.index({ user: 1, key: 1 }, { unique: true });

export default mongoose.models.NewsTopic ||
  mongoose.model("NewsTopic", newsTopicSchema);
