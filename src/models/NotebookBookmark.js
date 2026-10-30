import mongoose from "mongoose";

// A post the user saved on Instagram, imported from the "Download your
// information" export. One document per (user, code): importing a newer
// export updates what is there and adds what is new. A removed bookmark is
// kept as `dismissed`, so the next import does not bring it back.
const notebookBookmarkSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    // The post's shortcode, the part after /p/ or /reel/.
    code: { type: String, required: true, trim: true, maxlength: 64 },
    kind: { type: String, enum: ["post", "reel"], required: true },
    url: { type: String, required: true, trim: true, maxlength: 200 },
    caption: { type: String, default: "", maxlength: 2200 },
    ownerName: { type: String, default: "", trim: true, maxlength: 120 },
    ownerUsername: { type: String, default: "", trim: true, maxlength: 60 },
    // When it was saved on Instagram, as the export says; null if unknown.
    savedAt: { type: Date, default: null },
    // The last import that listed it.
    importedAt: { type: Date, default: null },
    dismissed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notebookBookmarkSchema.index({ user: 1, code: 1 }, { unique: true });
notebookBookmarkSchema.index({ user: 1, dismissed: 1, savedAt: -1 });

export default mongoose.models.NotebookBookmark ||
  mongoose.model("NotebookBookmark", notebookBookmarkSchema);
