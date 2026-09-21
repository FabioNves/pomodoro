import mongoose from "mongoose";

// A number the business keeps an eye on (revenue, customers, a KPI of its
// own). Every new value is also appended to `history`, capped by the route,
// so the screen can show the change since the last one. `source` is "manual"
// for a value typed in; a future module that feeds a metric writes its own
// name there. `pinned` metrics show on the Business overview.

const businessMetricSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    key: { type: String, required: true },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    kind: { type: String, enum: ["currency", "number", "percent"], default: "number" },
    hint: { type: String, default: "", trim: true, maxlength: 60 },
    value: { type: Number, default: null },
    target: { type: Number, default: null },
    pinned: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    source: { type: String, default: "manual" },
    history: {
      type: [new mongoose.Schema({ value: Number, at: { type: Date, default: Date.now } }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true },
);

businessMetricSchema.index({ business: 1, key: 1 }, { unique: true });

export default mongoose.models.BusinessMetric || mongoose.model("BusinessMetric", businessMetricSchema);
