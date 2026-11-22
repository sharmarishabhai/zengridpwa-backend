const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "MaintenanceTask", required: true, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
  type: { type: String, enum: ["before", "after"], required: true },
  publicId: { type: String, required: true }, secureUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("MaintenancePhoto", schema);
