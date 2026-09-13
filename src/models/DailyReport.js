const mongoose = require("mongoose");

const dailyReportSchema = new mongoose.Schema(
  {
    reportDate: { type: String, required: true, index: true },
    lrmUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lrmName: { type: String, required: true, trim: true },
    totalCalls: { type: Number, default: 0 },
    connectedCalls: { type: Number, default: 0 },
    meetingsScheduled: { type: Number, default: 0 },
    meetingsDone: { type: Number, default: 0 },
    ordersClosed: { type: Number, default: 0 },
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

dailyReportSchema.index({ reportDate: 1, lrmUserId: 1 }, { unique: true });

module.exports = mongoose.model("DailyReport", dailyReportSchema);
