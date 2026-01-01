const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  focusTime: { type: Number, required: true },
  breakTime: { type: Number, required: true },
  tasks: [
    {
      task: { type: String, required: false },
      completed: { type: Boolean, default: false },
      brand: {
        title: { type: String, required: true },
        milestone: { type: String },
      },
    },
  ],
  // Add current active project to session level
  currentProject: {
    title: { type: String, required: true },
    milestone: { type: String },
  },
  user: { type: String }, // Changed from ObjectId to String for Google user IDs
  sessionId: { type: String }, // For non-logged-in users
  isTemporary: { type: Boolean, default: false }, // Flag for temporary data
  date: { type: Date, default: Date.now },
});

// Check if model already exists before creating it
module.exports =
  mongoose.models.Session || mongoose.model("Session", sessionSchema);
