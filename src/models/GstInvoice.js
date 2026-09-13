const mongoose = require("mongoose");

const gstInvoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    leadName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    whatsappNumber: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    customerName: { type: String, default: "" },
    customerGSTIN: { type: String, default: "" },
    customerPAN: { type: String, default: "" },
    address: { type: String, default: "" },
    taxableAmount: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

gstInvoiceSchema.index({ leadId: 1, createdAt: -1 });
gstInvoiceSchema.index({ assignedToUserId: 1, createdAt: -1 });
gstInvoiceSchema.index({ assignedByUserId: 1, createdAt: -1 });

module.exports = mongoose.model("GstInvoice", gstInvoiceSchema);
