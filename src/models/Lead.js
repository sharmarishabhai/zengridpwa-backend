const mongoose = require("mongoose");
const { LEAD_STATUSES, MEETING_STATUSES, SOURCES } = require("../utils/leadConstants");

const leadSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    leadId: { type: String, unique: true, sparse: true, index: true },
    phone: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    area: { type: String, trim: true, default: "" },
    locality: { type: String, trim: true, default: "" },
    monthlyBill: { type: Number, default: 0 },
    source: {
      type: String,
      enum: Object.values(SOURCES),
      default: SOURCES.WEBSITE,
    },
    leadStatus: {
      type: String,
      enum: Object.values(LEAD_STATUSES),
      default: LEAD_STATUSES.NEW,
    },
    followUpDate: { type: String, default: "" },
    assignedTo: { type: String, trim: true, default: "" },
    assignedBy: { type: String, trim: true, default: "" },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    meetingDate: { type: String, default: "" },
    meetingTime: { type: String, default: "" },
    meetingStatus: {
      type: String,
      enum: Object.values(MEETING_STATUSES),
      default: MEETING_STATUSES.ASSIGNED,
    },
    note: { type: String, trim: true, default: "" },
    createdByRole: { type: String, trim: true, default: "" },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

leadSchema.index({ phone: 1 }, { unique: true });
leadSchema.index({ whatsappNumber: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ leadStatus: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, createdAt: -1 });
leadSchema.index({ assignedBy: 1, createdAt: -1 });
leadSchema.index({ assignedToUserId: 1, createdAt: -1 });
leadSchema.index({ assignedByUserId: 1, createdAt: -1 });
leadSchema.index({ meetingStatus: 1, meetingDate: 1 });
leadSchema.index({ followUpDate: 1 });

module.exports = mongoose.model("Lead", leadSchema);
