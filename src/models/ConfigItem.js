const mongoose = require("mongoose");

const CONFIG_TYPES = {
  SYSTEM_SIZE: "system-size",
  SOLAR_PANEL: "solar-panel",
  INVERTER: "inverter",
  STRUCTURE_TYPE: "structure-type",
  WIRING: "wiring",
  TAX_SUBSIDY: "tax-subsidy",
};

const configItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(CONFIG_TYPES), required: true, index: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    systemSize: { type: String, trim: true, default: "" },
    systemPrice: { type: Number, default: 0 },
    watt: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

configItemSchema.index({ type: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("ConfigItem", configItemSchema);
module.exports.CONFIG_TYPES = CONFIG_TYPES;
