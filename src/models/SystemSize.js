const mongoose = require("mongoose");

const systemSizeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    sizeKw: { type: Number, required: true },
    systemPrice: { type: Number, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemSize", systemSizeSchema);
