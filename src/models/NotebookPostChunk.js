import mongoose from "mongoose";

// One piece of a NotebookPostFile: chunk `n` holds bytes
// [n * chunkSize, (n + 1) * chunkSize) of the file.
const notebookPostChunkSchema = new mongoose.Schema({
  file: { type: mongoose.Schema.Types.ObjectId, ref: "NotebookPostFile", required: true },
  n: { type: Number, required: true },
  data: { type: Buffer, required: true },
});

notebookPostChunkSchema.index({ file: 1, n: 1 }, { unique: true });

export default mongoose.models.NotebookPostChunk ||
  mongoose.model("NotebookPostChunk", notebookPostChunkSchema);
