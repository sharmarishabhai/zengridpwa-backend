const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentNo: { type: String, required: true, unique: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    leadName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    whatsappNumber: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, required: true },
    remainingAmount: { type: Number, required: true },
    paymentMode: { type: String, default: "Cash" },
    receivedBy: { type: String, default: "" },
    notes: { type: String, default: "" },
    paymentDate: { type: String, required: true, index: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

paymentSchema.index({ leadId: 1, paymentDate: -1 });
paymentSchema.index({ assignedToUserId: 1, paymentDate: -1 });
paymentSchema.index({ assignedByUserId: 1, paymentDate: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
