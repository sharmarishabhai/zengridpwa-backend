const mongoose = require("mongoose");

const plantSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, unique: true, index: true },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  locationLabel: { type: String, trim: true, default: "" },
  installedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

plantSchema.index({ latitude: 1, longitude: 1 });
module.exports = mongoose.model("Plant", plantSchema);
