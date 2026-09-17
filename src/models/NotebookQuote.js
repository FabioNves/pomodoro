import mongoose from "mongoose";

// One quotation in the notebook's Quotes view. Quotes belong to an author
// (NotebookQuoteAuthor, matched through `authorKey`); the dashboard's slot
// machine spins through the active quotes of active authors.
const notebookQuoteSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 600 },
    author: { type: String, required: true, trim: true, maxlength: 120 },
    // Normalised author name ("Marcus Aurelius" == "marcus aurelius").
    authorKey: { type: String, required: true },
    // Where the words come from (book, speech, year), free text.
    source: { type: String, default: "", trim: true, maxlength: 200 },
    // Page the quote was found on, when it came from a web search.
    sourceUrl: { type: String, default: "", trim: true, maxlength: 1000 },
    // manual: typed in; ai: from the model's memory; web: found on a page.
    origin: { type: String, enum: ["manual", "ai", "web"], default: "manual" },
    // True when the text was checked verbatim against the page it cites.
    verified: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

notebookQuoteSchema.index({ user: 1, authorKey: 1 });
notebookQuoteSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.NotebookQuote ||
  mongoose.model("NotebookQuote", notebookQuoteSchema);
