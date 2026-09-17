import mongoose from "mongoose";

// A file behind a saved post (the media itself or its thumbnail). The bytes
// live in NotebookPostChunk documents of `chunkSize` bytes each, written one
// request at a time; the file is `complete` once every chunk has arrived.
const notebookPostFileSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    name: { type: String, default: "", trim: true, maxlength: 255 },
    mime: { type: String, required: true, maxlength: 100 },
    size: { type: Number, required: true, min: 0 },
    chunkSize: { type: Number, required: true },
    chunkCount: { type: Number, required: true },
    received: { type: Number, default: 0 },
    complete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notebookPostFileSchema.index({ user: 1, complete: 1, createdAt: 1 });

export default mongoose.models.NotebookPostFile ||
  mongoose.model("NotebookPostFile", notebookPostFileSchema);
