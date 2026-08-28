const mongoose = require("mongoose");

const quoteSchema = new mongoose.Schema(
  {
    quoteNo: { type: String, required: true, unique: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    leadName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    area: { type: String, trim: true, default: "" },
    monthlyBill: { type: Number, default: 0 },
    systemSize: { type: String, default: "" },
    panel: { type: String, default: "" },
    inverter: { type: String, default: "" },
    structure: { type: String, default: "" },
    floor: { type: String, default: "" },
    inverterLocation: { type: String, default: "" },
    cleaning: { type: String, default: "" },
    price: { type: Number, default: 0 },
    discount1: { type: Number, default: 0 },
    discount2: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 0 },
    subsidy1: { type: Number, default: 0 },
    subsidy2: { type: Number, default: 0 },
    note: { type: String, trim: true, default: "" },
    netPrice: { type: Number, default: 0 },
    netEffectivePrice: { type: Number, default: 0 },
    generatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

quoteSchema.index({ leadId: 1, createdAt: -1 });
quoteSchema.index({ assignedToUserId: 1, createdAt: -1 });
quoteSchema.index({ assignedByUserId: 1, createdAt: -1 });

module.exports = mongoose.model("Quote", quoteSchema);
