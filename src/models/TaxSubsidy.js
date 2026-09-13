const mongoose = require("mongoose");

const taxSubsidySchema = new mongoose.Schema(
  {
    gstPercent: { type: Number, default: 8.9 },
    centralSubsidy: { type: Number, default: 78000 },
    upnedaSubsidy: { type: Number, default: 30000 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TaxSubsidy", taxSubsidySchema);
