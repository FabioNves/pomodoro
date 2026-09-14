import mongoose from "mongoose";

// Per-user notebook settings: the subjects shown in the Brain view and the
// user's saved views. One document per user, created on first use with the
// suggested subjects already in place (see src/lib/notebook/subjects.js).
const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    // Normalised name used for de-duplication ("Ideas" == "ideas").
    key: { type: String, required: true },
    color: { type: String, required: true },
    source: {
      type: String,
      enum: ["suggested", "custom"],
      default: "custom",
    },
  },
  { _id: false },
);

const viewSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  layout: { type: String, enum: ["list", "grid"], default: "list" },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "NotebookFolder",
    default: null,
  },
  subjects: { type: [String], default: [] },
  sort: {
    type: String,
    enum: ["updated", "created", "title"],
    default: "updated",
  },
});

const notebookSettingsSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, unique: true },
    subjects: { type: [subjectSchema], default: [] },
    views: { type: [viewSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.models.NotebookSettings ||
  mongoose.model("NotebookSettings", notebookSettingsSchema);
