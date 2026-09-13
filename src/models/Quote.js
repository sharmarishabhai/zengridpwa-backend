const mongoose = require("mongoose");

const quoteSchema = new mongoose.Schema(
  {
    quoteNo: { type: String, required: true, unique: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    leadName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    whatsappNumber: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    area: { type: String, trim: true, default: "" },
    monthlyBill: { type: Number, default: 0 },
    systemSize: { type: String, default: "" },
    systemSizeConfigId: { type: mongoose.Schema.Types.ObjectId, ref: "ConfigItem", default: null },
    panel: { type: String, default: "" },
    panelConfigId: { type: mongoose.Schema.Types.ObjectId, ref: "ConfigItem", default: null },
    inverter: { type: String, default: "" },
    inverterConfigId: { type: mongoose.Schema.Types.ObjectId, ref: "ConfigItem", default: null },
    structure: { type: String, default: "" },
    structureConfigId: { type: mongoose.Schema.Types.ObjectId, ref: "ConfigItem", default: null },
    wiring: { type: String, default: "" },
    wiringConfigId: { type: mongoose.Schema.Types.ObjectId, ref: "ConfigItem", default: null },
    floor: { type: String, default: "" },
    inverterLocation: { type: String, default: "" },
    cleaning: { type: String, default: "" },
    minimumPrice: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    overheadPrice: { type: Number, default: 0 },
    topup: { type: Number, default: 0 },
    discount1: { type: Number, default: 0 },
    discount2: { type: Number, default: 0 },
    extraDiscount: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
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
