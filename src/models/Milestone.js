const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  user: { type: String }, // Changed from ObjectId to String for Google user IDs
  sessionId: { type: String }, // For non-logged-in users
  isTemporary: { type: Boolean, default: false }, // Flag for temporary data
});

module.exports =
  mongoose.models.Milestone || mongoose.model("Milestone", milestoneSchema);
