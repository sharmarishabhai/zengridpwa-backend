const mongoose = require("mongoose");

const maintenanceTaskSchema = new mongoose.Schema({
  plantId: { type: mongoose.Schema.Types.ObjectId, ref: "Plant", required: true, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
  assignedPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  scheduledDate: { type: Date, required: true, index: true },
  status: { type: String, enum: ["Unassigned", "Scheduled", "In Progress", "Completed", "Cancelled"], default: "Scheduled", index: true },
  startedAt: { type: Date, default: null }, completedAt: { type: Date, default: null },
  recurringGenerated: { type: Boolean, default: false },
  recurrencePaused: { type: Boolean, default: false },
}, { timestamps: true });
maintenanceTaskSchema.index({ plantId: 1, scheduledDate: 1 }, { unique: true });
module.exports = mongoose.model("MaintenanceTask", maintenanceTaskSchema);
