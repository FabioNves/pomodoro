import mongoose from "mongoose";

// One document per deployment: the admin's edits to the feature registry and
// the plan pricing. src/lib/access/features.js holds the defaults and merges
// this over them, so only what was changed needs to be here.
const featureSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, default: "" },
    description: { type: String, default: "" },
    availableToFree: { type: Boolean, default: true },
    availableToPremium: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    tagline: { type: String, default: "" },
    price: { type: Number, default: 0 },
    currency: { type: String, default: "EUR" },
    interval: { type: String, default: "month" },
    status: { type: String, default: "available" },
    checkoutUrl: { type: String, default: "" },
  },
  { _id: false },
);

const accessConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    features: { type: [featureSchema], default: [] },
    plans: {
      free: { type: planSchema, default: undefined },
      premium: { type: planSchema, default: undefined },
    },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.models.AccessConfig || mongoose.model("AccessConfig", accessConfigSchema);
