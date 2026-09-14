import mongoose from "mongoose";

// One tab of a document. Tabs nest through `parent` (the _id of another tab
// in the same document, as a string), up to three levels deep.
const tabSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  // Sanitised HTML produced by the notebook editor.
  content: { type: String, default: "", maxlength: 200000 },
  parent: { type: String, default: null },
  order: { type: Number, default: 0 },
});

const notebookDocumentSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: "Untitled",
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NotebookFolder",
      default: null,
    },
    order: { type: Number, default: 0 },
    // Subject names from NotebookSettings.subjects; the Brain view links a
    // note to every subject it carries.
    subjects: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
    tabs: { type: [tabSchema], default: [] },
    // Derived from the tab contents on every save so the note lists and the
    // Brain graph never have to load the contents themselves:
    // titles referenced as [[Note title]] anywhere in the document, ...
    links: { type: [String], default: [] },
    // ... the first few lines of text, and the word count.
    preview: { type: String, default: "", maxlength: 400 },
    wordCount: { type: Number, default: 0 },
    lastOpenedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notebookDocumentSchema.index({ user: 1, folder: 1 });
notebookDocumentSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.models.NotebookDocument ||
  mongoose.model("NotebookDocument", notebookDocumentSchema);
