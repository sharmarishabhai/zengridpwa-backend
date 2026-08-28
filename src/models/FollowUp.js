const mongoose = require("mongoose");
const { LEAD_STATUSES } = require("../utils/leadConstants");

const followUpSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    leadName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    assignedTo: { type: String, trim: true, default: "" },
    assignedBy: { type: String, trim: true, default: "" },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    followUpDate: { type: String, required: true },
    followUpTime: { type: String, default: "" },
    status: {
      type: String,
      enum: Object.values(LEAD_STATUSES),
      default: LEAD_STATUSES.FOLLOW_UP,
    },
    note: { type: String, trim: true, default: "" },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

followUpSchema.index({ followUpDate: 1, createdAt: -1 });
followUpSchema.index({ assignedTo: 1, followUpDate: 1 });
followUpSchema.index({ assignedBy: 1, followUpDate: 1 });
followUpSchema.index({ assignedToUserId: 1, followUpDate: 1 });
followUpSchema.index({ assignedByUserId: 1, followUpDate: 1 });

module.exports = mongoose.model("FollowUp", followUpSchema);
