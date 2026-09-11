import mongoose from "mongoose";

// One retrieved web page. Shared between users (it describes a public
// article, not a user's data) and keyed by the canonical URL. Only a bounded
// excerpt is stored, never the full article body.
const newsArticleSchema = new mongoose.Schema(
  {
    urlKey: { type: String, required: true, unique: true, index: true },
    url: { type: String, required: true },
    title: { type: String, default: "", maxlength: 500 },
    domain: { type: String, default: "", index: true },
    publisher: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
    // Where the date came from: the search provider's metadata, the URL
    // path (e.g. /2026/09/10/), or nothing. Never guessed by the model.
    publishedAtSource: {
      type: String,
      enum: ["metadata", "url", ""],
      default: "",
    },
    snippet: { type: String, default: "", maxlength: 1200 },
    excerpt: { type: String, default: "", maxlength: 6000 },
    excerptFetchedAt: { type: Date, default: null },
    retrievedVia: {
      tool: { type: String, default: "" },
      server: { type: String, default: "" },
    },
    lastScore: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.models.NewsArticle ||
  mongoose.model("NewsArticle", newsArticleSchema);
