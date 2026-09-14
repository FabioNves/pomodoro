import mongoose from "mongoose";

// A folder in the notebook. Folders nest through `parent`; documents point
// at the folder they live in (see NotebookDocument).
const notebookFolderSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NotebookFolder",
      default: null,
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

notebookFolderSchema.index({ user: 1, parent: 1, order: 1 });

export default mongoose.models.NotebookFolder ||
  mongoose.model("NotebookFolder", notebookFolderSchema);
