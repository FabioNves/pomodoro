import mongoose from "mongoose";

// A quote read aloud by the AI voice, kept so the quote player can replay it
// without paying for it again. Keyed by what was spoken and how (model,
// voice, style and words), so the same quote is shared by every reader who
// has it and a change of voice makes a new clip. `user` is whoever first
// asked for it, which is what the daily limit on new clips counts.
const quoteSpeechSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  user: { type: String, default: null },
  model: { type: String, required: true },
  voice: { type: String, required: true },
  mime: { type: String, default: "audio/mpeg" },
  audio: { type: Buffer, required: true },
  bytes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// Clips are dropped six months after they were made, however often they are
// played; a quote read after that is simply made again.
quoteSpeechSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });
quoteSpeechSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.QuoteSpeech || mongoose.model("QuoteSpeech", quoteSpeechSchema);
