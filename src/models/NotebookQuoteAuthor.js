import mongoose from "mongoose";

// An author in the Quotes view. Created when the first quote by that name
// is saved; `active` decides whether the author's quotes take part in the
// dashboard slot machine. One document per (user, key).
const notebookQuoteAuthorSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Normalised name used for matching (see authorKey() in lib/notebook/quotes.js).
    key: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

notebookQuoteAuthorSchema.index({ user: 1, key: 1 }, { unique: true });

export default mongoose.models.NotebookQuoteAuthor ||
  mongoose.model("NotebookQuoteAuthor", notebookQuoteAuthorSchema);
