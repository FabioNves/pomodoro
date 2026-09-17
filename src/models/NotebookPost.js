import mongoose from "mongoose";
import { PLATFORM_KEYS, POST_KINDS } from "@/lib/notebook/posts";

// A saved post in the notebook: an image or video the user dropped in
// (stored as a NotebookPostFile, with a small NotebookPostFile thumbnail),
// or just a link to the original post when there is no file.
const notebookPostSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    title: { type: String, default: "", trim: true, maxlength: 200 },
    note: { type: String, default: "", trim: true, maxlength: 2000 },
    platform: { type: String, enum: PLATFORM_KEYS, default: "other" },
    sourceUrl: { type: String, default: "", trim: true, maxlength: 1000 },
    kind: { type: String, enum: POST_KINDS, required: true },
    file: { type: mongoose.Schema.Types.ObjectId, ref: "NotebookPostFile", default: null },
    thumb: { type: mongoose.Schema.Types.ObjectId, ref: "NotebookPostFile", default: null },
    // Pixel size of the media and, for videos, its length in seconds.
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notebookPostSchema.index({ user: 1, createdAt: -1 });
// Answers "does a post already use this upload?" without a collection scan.
notebookPostSchema.index({ user: 1, file: 1 });
notebookPostSchema.index({ user: 1, thumb: 1 });

export default mongoose.models.NotebookPost ||
  mongoose.model("NotebookPost", notebookPostSchema);
