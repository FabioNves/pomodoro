import mongoose from "mongoose";

// A folder in Bookmarks, usually one per Instagram account an export came
// from. Bookmarks point at it through NotebookBookmark.folder; deleting the
// folder either deletes them or leaves them without a folder.
const notebookBookmarkFolderSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { timestamps: true },
);

export default mongoose.models.NotebookBookmarkFolder ||
  mongoose.model("NotebookBookmarkFolder", notebookBookmarkFolderSchema);
