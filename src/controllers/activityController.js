const Lead = require("../models/Lead");
const Meeting = require("../models/Meeting");
const Quote = require("../models/Quote");
const Payment = require("../models/Payment");
const GstInvoice = require("../models/GstInvoice");
const { ROLES } = require("../utils/constants");
const { MEETING_STATUSES, LEAD_STATUSES } = require("../utils/leadConstants");
const mongoose = require("mongoose");

function ensureValidLeadId(leadId, res) {
  if (!mongoose.Types.ObjectId.isValid(leadId)) {
    res.status(400).json({ success: false, message: "Invalid leadId" });
    return false;
  }
  return true;
}

function makeNo(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function roleQuery(user) {
  if (user.userType === ROLES.ADMIN) return {};
  if (user.userType === ROLES.LRM) return { assignedByUserId: user._id };
  if (user.userType === ROLES.SC) return { assignedToUserId: user._id };
  return { _id: null };
}

async function addMeeting(req, res) {
  if (!ensureValidLeadId(req.params.leadId, res)) return;
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  const { meetingDate, meetingTime = "", note = "", meetingStatus = MEETING_STATUSES.ASSIGNED } = req.body;
  if (!meetingDate) return res.status(400).json({ success: false, message: "meetingDate is required" });
  const meeting = await Meeting.create({
    leadId: lead._id,
    leadName: lead.customerName,
    phone: lead.phone,
    assignedTo: lead.assignedTo,
    assignedBy: lead.assignedBy,
    assignedToUserId: lead.assignedToUserId,
    assignedByUserId: lead.assignedByUserId,
    meetingDate,
    meetingTime,
    meetingStatus,
    note,
    createdByUserId: req.user._id,
  });
  lead.meetingDate = meetingDate;
  lead.meetingTime = meetingTime;
  lead.meetingStatus = meetingStatus;
  if (note) lead.note = lead.note ? `${lead.note}\n[Meeting] ${note}` : `[Meeting] ${note}`;
  await lead.save();
  return res.status(201).json({ success: true, meeting, lead });
}

async function listMeetings(req, res) {
  const query = roleQuery(req.user);
  const meetings = await Meeting.find(query).sort({ meetingDate: 1, createdAt: -1 }).limit(500);
  return res.json({ success: true, meetings });
}

async function updateMeetingDone(req, res) {
  if (!ensureValidLeadId(req.params.leadId, res)) return;
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  const { outcome, remarks = "", followUpDate = "" } = req.body;
  if (!outcome) return res.status(400).json({ success: false, message: "outcome is required" });
  const meeting = await Meeting.create({
    leadId: lead._id,
    leadName: lead.customerName,
    phone: lead.phone,
    assignedTo: lead.assignedTo,
    assignedBy: lead.assignedBy,
    assignedToUserId: lead.assignedToUserId,
    assignedByUserId: lead.assignedByUserId,
    meetingDate: lead.meetingDate || new Date().toISOString().slice(0, 10),
    meetingTime: lead.meetingTime || "",
    meetingStatus: MEETING_STATUSES.DONE,
    note: remarks,
    createdByUserId: req.user._id,
  });
  lead.meetingStatus = MEETING_STATUSES.DONE;
  lead.leadStatus = outcome;
  if (followUpDate) lead.followUpDate = followUpDate;
  if (remarks) lead.note = lead.note ? `${lead.note}\n[Meeting] ${remarks}` : `[Meeting] ${remarks}`;
  await lead.save();
  return res.json({ success: true, meeting, lead });
}

async function addQuote(req, res) {
  if (!ensureValidLeadId(req.params.leadId, res)) return;
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  const quote = await Quote.create({
    quoteNo: makeNo("Q"),
    leadId: lead._id,
    leadName: lead.customerName,
    phone: lead.phone,
    area: lead.area,
    monthlyBill: lead.monthlyBill,
    systemSize: req.body.systemSize || "",
    panel: req.body.panel || "",
    inverter: req.body.inverter || "",
    structure: req.body.structure || "",
    floor: req.body.floor || "",
    inverterLocation: req.body.inverterLocation || "",
    cleaning: req.body.cleaning || "",
    price: Number(req.body.price || 0),
    discount1: Number(req.body.discount1 || 0),
    discount2: Number(req.body.discount2 || 0),
    gstPercent: Number(req.body.gstPercent || 0),
    subsidy1: Number(req.body.subsidy1 || 0),
    subsidy2: Number(req.body.subsidy2 || 0),
    note: req.body.note || "",
    netPrice: Number(req.body.price || 0) - Number(req.body.discount1 || 0) - Number(req.body.discount2 || 0),
    netEffectivePrice: Number(req.body.price || 0) - Number(req.body.discount1 || 0) - Number(req.body.discount2 || 0) - Number(req.body.subsidy1 || 0) - Number(req.body.subsidy2 || 0),
    generatedByUserId: req.user._id,
    assignedToUserId: lead.assignedToUserId,
    assignedByUserId: lead.assignedByUserId,
  });
  return res.status(201).json({ success: true, quote });
}

async function listQuotes(req, res) {
  const query = roleQuery(req.user);
  const quotes = await Quote.find(query).sort({ createdAt: -1 }).limit(500);
  return res.json({ success: true, quotes });
}

async function addPayment(req, res) {
  if (!ensureValidLeadId(req.params.leadId, res)) return;
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  const totalAmount = Number(req.body.totalAmount || 0);
  const paidAmount = Number(req.body.paidAmount || 0);
  if (!totalAmount || !paidAmount) return res.status(400).json({ success: false, message: "totalAmount and paidAmount are required" });
  const payment = await Payment.create({
    paymentNo: makeNo("P"),
    leadId: lead._id,
    leadName: lead.customerName,
    phone: lead.phone,
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
    paymentMode: req.body.paymentMode || "Cash",
    receivedBy: req.body.receivedBy || "",
    notes: req.body.notes || "",
    paymentDate: req.body.paymentDate || new Date().toISOString().slice(0, 10),
    createdByUserId: req.user._id,
    assignedToUserId: lead.assignedToUserId,
    assignedByUserId: lead.assignedByUserId,
  });
  return res.status(201).json({ success: true, payment });
}

async function listPayments(req, res) {
  const query = roleQuery(req.user);
  const payments = await Payment.find(query).sort({ paymentDate: -1, createdAt: -1 }).limit(500);
  return res.json({ success: true, payments });
}

async function addGstInvoice(req, res) {
  if (!ensureValidLeadId(req.params.leadId, res)) return;
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  const invoice = await GstInvoice.create({
    invoiceNo: makeNo("GST"),
    leadId: lead._id,
    leadName: lead.customerName,
    phone: lead.phone,
    customerName: req.body.customerName || lead.customerName,
    customerGSTIN: req.body.customerGSTIN || "",
    customerPAN: req.body.customerPAN || "",
    address: req.body.address || "",
    taxableAmount: Number(req.body.taxableAmount || 0),
    cgst: Number(req.body.cgst || 0),
    sgst: Number(req.body.sgst || 0),
    igst: Number(req.body.igst || 0),
    notes: req.body.notes || "",
    createdByUserId: req.user._id,
    assignedToUserId: lead.assignedToUserId,
    assignedByUserId: lead.assignedByUserId,
  });
  return res.status(201).json({ success: true, invoice });
}

async function listGstInvoices(req, res) {
  const query = roleQuery(req.user);
  const invoices = await GstInvoice.find(query).sort({ createdAt: -1 }).limit(500);
  return res.json({ success: true, invoices });
}

async function dashboardSummary(req, res) {
  const query = roleQuery(req.user);
  const leads = await Lead.find(query).select("_id leadStatus followUpDate assignedTo assignedBy meetingStatus");
  const followUps = await require("../models/FollowUp").find(query).select("followUpDate");
  const meetings = await Meeting.find(query).select("meetingStatus meetingDate");
  const payments = await Payment.find(query).select("paidAmount remainingAmount");
  const quotes = await Quote.find(query).select("_id");
  const today = new Date().toISOString().slice(0, 10);
  return res.json({
    success: true,
    summary: {
      totalLeads: leads.length,
      totalFollowUps: followUps.length,
      followUpsToday: followUps.filter((f) => f.followUpDate === today).length,
      overdueFollowUps: followUps.filter((f) => f.followUpDate && f.followUpDate < today).length,
      meetingsTotal: meetings.length,
      meetingsDone: meetings.filter((m) => m.meetingStatus === MEETING_STATUSES.DONE).length,
      totalQuotes: quotes.length,
      totalPayments: payments.length,
      won: leads.filter((l) => l.leadStatus === LEAD_STATUSES.WON).length,
    },
  });
}

module.exports = {
  addMeeting,
  listMeetings,
  updateMeetingDone,
  addQuote,
  listQuotes,
  addPayment,
  listPayments,
  addGstInvoice,
  listGstInvoices,
  dashboardSummary,
};

