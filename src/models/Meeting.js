const mongoose = require("mongoose");
const { MEETING_STATUSES } = require("../utils/leadConstants");

const meetingSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    leadName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    assignedTo: { type: String, trim: true, default: "" },
    assignedBy: { type: String, trim: true, default: "" },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    meetingDate: { type: String, required: true, index: true },
    meetingTime: { type: String, default: "" },
    meetingStatus: {
      type: String,
      enum: Object.values(MEETING_STATUSES),
      default: MEETING_STATUSES.ASSIGNED,
      index: true,
    },
    note: { type: String, trim: true, default: "" },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

meetingSchema.index({ leadId: 1, meetingDate: 1 });
meetingSchema.index({ assignedTo: 1, meetingDate: 1 });
meetingSchema.index({ assignedToUserId: 1, meetingDate: 1 });

module.exports = mongoose.model("Meeting", meetingSchema);
