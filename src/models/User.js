const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  imageUrl: { type: String },
});

// Check if model already exists before creating it
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
