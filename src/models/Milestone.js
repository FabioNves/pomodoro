const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Optional for logged-in users
  sessionId: { type: String }, // For non-logged-in users
  isTemporary: { type: Boolean, default: false }, // Flag for temporary data
});

module.exports = mongoose.model("Milestone", milestoneSchema);
