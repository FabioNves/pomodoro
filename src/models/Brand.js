import mongoose from "mongoose";

const brandSchema = new mongoose.Schema({
  name: String,
  user: String,
  sessionId: String,
  isTemporary: Boolean,
});

export default mongoose.models.Brand || mongoose.model("Brand", brandSchema);
