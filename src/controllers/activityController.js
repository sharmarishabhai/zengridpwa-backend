const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Meeting = require("../models/Meeting");
const Quote = require("../models/Quote");
const Payment = require("../models/Payment");
const GstInvoice = require("../models/GstInvoice");
const ConfigItem = require("../models/ConfigItem");
const SystemSize = require("../models/SystemSize");
const SolarPanel = require("../models/SolarPanel");
const Inverter = require("../models/Inverter");
const StructureType = require("../models/StructureType");
const WiringOption = require("../models/WiringOption");
const DailyReport = require("../models/DailyReport");
const { ROLES } = require("../utils/constants");
const { MEETING_STATUSES, LEAD_STATUSES } = require("../utils/leadConstants");

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

function scopedQuery(user, extra = {}) {
  return { ...roleQuery(user), ...extra };
}

function canUseLead(user, lead) {
  if (user.userType === ROLES.ADMIN) return true;
  if (user.userType === ROLES.LRM) {
    return String(lead.assignedByUserId || "") === String(user._id) || String(lead.createdByUserId || "") === String(user._id);
  }
  if (user.userType === ROLES.SC) return String(lead.assignedToUserId || "") === String(user._id);
  return false;
}

async function activeOption(id, fallback, type) {
  if (!id) return { name: fallback || "", item: null };
  const modelByType = {
    "system-size": SystemSize,
    "solar-panel": SolarPanel,
    inverter: Inverter,
    "structure-type": StructureType,
    wiring: WiringOption,
  };
  const Model = modelByType[type];
  const item = Model
    ? await Model.findOne({ _id: id, status: "active" })
    : await ConfigItem.findOne({ _id: id, type, status: "active" });
  return { name: item?.name || fallback || "", item };
}

async function addMeeting(req, res) {
  if (!ensureValidLeadId(req.params.leadId, res)) return;
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  if (!canUseLead(req.user, lead)) return res.status(403).json({ success: false, message: "Forbidden" });
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
  const filter = scopedQuery(req.user, req.query.date ? { meetingDate: req.query.date } : {});
  const meetings = await Meeting.find(filter).sort({ meetingDate: 1, createdAt: -1 }).limit(500);
  return res.json({ success: true, meetings });
}

async function updateMeetingDone(req, res) {
  if (!ensureValidLeadId(req.params.leadId, res)) return;
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  if (!canUseLead(req.user, lead)) return res.status(403).json({ success: false, message: "Forbidden" });
  const { outcome, remarks = "", followUpDate = "", followUpTime = "" } = req.body;
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
  if (followUpTime) lead.followUpTime = followUpTime;
  if (remarks) lead.note = lead.note ? `${lead.note}\n[Meeting] ${remarks}` : `[Meeting] ${remarks}`;
  await lead.save();
  return res.json({ success: true, meeting, lead });
}

async function addQuote(req, res) {
  if (!ensureValidLeadId(req.params.leadId, res)) return;
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  if (!canUseLead(req.user, lead)) return res.status(403).json({ success: false, message: "Forbidden" });
  const system = await activeOption(req.body.systemSizeConfigId, req.body.systemSize, "system-size");
  if (!system.item && !req.body.systemSize) return res.status(400).json({ success: false, message: "system size is required" });
  const panel = await activeOption(req.body.panelConfigId, req.body.panel, "solar-panel");
  const inverter = await activeOption(req.body.inverterConfigId, req.body.inverter, "inverter");
  const structure = await activeOption(req.body.structureConfigId, req.body.structure, "structure-type");
  const wiring = await activeOption(req.body.wiringConfigId, req.body.wiring, "wiring");
  const minimumPrice = Number(system.item?.systemPrice || req.body.minimumPrice || 0);
  const overheadPrice = Number(req.body.overheadPrice ?? req.body.topup ?? 0);
  const price = Number(req.body.price || minimumPrice + overheadPrice || 0);
  const discount1 = Number(req.body.discount1 || 0);
  const discount2 = Number(req.body.discount2 || 0);
  const extraDiscount = Number(req.body.extraDiscount || 0);
  const totalDiscount = discount1 + discount2 + extraDiscount;
  if (totalDiscount > price) return res.status(400).json({ success: false, message: "Discount cannot be more than system price" });
  const gstPercent = Number(req.body.gstPercent || 0);
  const netBeforeGst = Math.max(0, price - totalDiscount);
  const gstAmount = Math.round((netBeforeGst * gstPercent) / 100);
  const subsidy1 = Number(req.body.subsidy1 || 0);
  const subsidy2 = Number(req.body.subsidy2 || 0);
  const netPrice = netBeforeGst + gstAmount;
  const netEffectivePrice = Math.max(0, netPrice - subsidy1 - subsidy2);
  const quote = await Quote.create({
    quoteNo: makeNo("Q"),
    leadId: lead._id,
    leadName: lead.customerName,
    phone: lead.phone,
    whatsappNumber: lead.whatsappNumber,
    email: lead.email,
    address: lead.address,
    area: lead.area,
    monthlyBill: lead.monthlyBill,
    systemSize: system.name,
    systemSizeConfigId: system.item?._id || null,
    panel: panel.name,
    panelConfigId: panel.item?._id || null,
    inverter: inverter.name,
    inverterConfigId: inverter.item?._id || null,
    structure: structure.name,
    structureConfigId: structure.item?._id || null,
    wiring: wiring.name,
    wiringConfigId: wiring.item?._id || null,
    floor: req.body.floor || "",
    inverterLocation: req.body.inverterLocation || "",
    cleaning: req.body.cleaning || "No",
    minimumPrice,
    price,
    overheadPrice,
    topup: overheadPrice,
    discount1,
    discount2,
    extraDiscount,
    gstPercent,
    gstAmount,
    subsidy1,
    subsidy2,
    note: req.body.note || "",
    netPrice,
    netEffectivePrice,
    generatedByUserId: req.user._id,
    assignedToUserId: lead.assignedToUserId,
    assignedByUserId: lead.assignedByUserId,
  });
  return res.status(201).json({ success: true, quote });
}

async function listQuotes(req, res) {
  const quotes = await Quote.find(roleQuery(req.user)).sort({ createdAt: -1 }).limit(500);
  return res.json({ success: true, quotes });
}

async function addPayment(req, res) {
  if (!ensureValidLeadId(req.params.leadId, res)) return;
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  if (!canUseLead(req.user, lead)) return res.status(403).json({ success: false, message: "Forbidden" });
  const totalAmount = Number(req.body.totalAmount || 0);
  const paidAmount = Number(req.body.paidAmount || 0);
  if (!totalAmount || !paidAmount) return res.status(400).json({ success: false, message: "totalAmount and paidAmount are required" });
  const payment = await Payment.create({
    paymentNo: makeNo("P"),
    leadId: lead._id,
    leadName: lead.customerName,
    phone: lead.phone,
    whatsappNumber: lead.whatsappNumber,
    email: lead.email,
    address: lead.address,
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
    paymentMode: req.body.paymentMode || "Cash",
    receivedBy: req.body.receivedBy || "",
    notes: req.body.notes || req.body.note || "",
    paymentDate: req.body.paymentDate || new Date().toISOString().slice(0, 10),
    createdByUserId: req.user._id,
    assignedToUserId: lead.assignedToUserId,
    assignedByUserId: lead.assignedByUserId,
  });
  return res.status(201).json({ success: true, payment });
}

async function listPayments(req, res) {
  const payments = await Payment.find(roleQuery(req.user)).sort({ paymentDate: -1, createdAt: -1 }).limit(500);
  return res.json({ success: true, payments });
}

async function addGstInvoice(req, res) {
  if (!ensureValidLeadId(req.params.leadId, res)) return;
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  if (!canUseLead(req.user, lead)) return res.status(403).json({ success: false, message: "Forbidden" });
  const invoice = await GstInvoice.create({
    invoiceNo: makeNo("GST"),
    leadId: lead._id,
    leadName: lead.customerName,
    phone: lead.phone,
    whatsappNumber: lead.whatsappNumber,
    email: lead.email,
    customerName: req.body.customerName || lead.customerName,
    customerGSTIN: req.body.customerGSTIN || "",
    customerPAN: req.body.customerPAN || "",
    address: req.body.address || lead.address || "",
    taxableAmount: Number(req.body.taxableAmount || 0),
    cgst: Number(req.body.cgst || 0),
    sgst: Number(req.body.sgst || 0),
    igst: Number(req.body.igst || 0),
    notes: req.body.notes || req.body.note || "",
    createdByUserId: req.user._id,
    assignedToUserId: lead.assignedToUserId,
    assignedByUserId: lead.assignedByUserId,
  });
  return res.status(201).json({ success: true, invoice });
}

async function listGstInvoices(req, res) {
  const invoices = await GstInvoice.find(roleQuery(req.user)).sort({ createdAt: -1 }).limit(500);
  return res.json({ success: true, invoices });
}

async function dashboardSummary(req, res) {
  const query = roleQuery(req.user);
  const [leads, followUps, meetings, payments, quotes, invoices] = await Promise.all([
    Lead.find(query).select("_id leadStatus followUpDate assignedTo assignedBy meetingStatus createdAt"),
    require("../models/FollowUp").find(query).select("followUpDate"),
    Meeting.find(query).select("meetingStatus meetingDate"),
    Payment.find(query).select("paidAmount remainingAmount paymentDate leadName"),
    Quote.find(query).select("_id createdAt"),
    GstInvoice.find(query).select("_id createdAt"),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const monthlyLeads = {};
  const monthlyRevenue = {};
  leads.forEach((l) => {
    const key = new Date(l.createdAt).toISOString().slice(0, 7);
    monthlyLeads[key] = (monthlyLeads[key] || 0) + 1;
  });
  payments.forEach((p) => {
    const key = (p.paymentDate || "").slice(0, 7);
    monthlyRevenue[key] = (monthlyRevenue[key] || 0) + Number(p.paidAmount || 0);
  });
  const leadStatus = leads.reduce((acc, lead) => {
    acc[lead.leadStatus] = (acc[lead.leadStatus] || 0) + 1;
    return acc;
  }, {});
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
      totalGstInvoices: invoices.length,
      revenueTotal: payments.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0),
      pendingAmount: payments.reduce((sum, p) => sum + Number(p.remainingAmount || 0), 0),
      won: leads.filter((l) => l.leadStatus === LEAD_STATUSES.WON).length,
      monthlyLeads,
      monthlyRevenue,
      leadStatus,
      recentPayments: payments.slice(0, 5),
    },
  });
}

async function saveDailyReport(req, res) {
  if (![ROLES.ADMIN, ROLES.LRM].includes(req.user.userType)) {
    return res.status(403).json({ success: false, message: "Only LRM or admin can submit daily report" });
  }
  const targetUserId = req.body.lrmUserId || req.user._id;
  if (req.user.userType !== ROLES.ADMIN && String(targetUserId) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  const reportDate = req.body.reportDate || new Date().toISOString().slice(0, 10);
  const report = await DailyReport.findOneAndUpdate(
    { reportDate, lrmUserId: targetUserId },
    {
      reportDate,
      lrmUserId: targetUserId,
      lrmName: req.body.lrmName || `${req.user.firstName} ${req.user.lastName}`.trim(),
      totalCalls: Number(req.body.totalCalls || 0),
      connectedCalls: Number(req.body.connectedCalls || 0),
      meetingsScheduled: Number(req.body.meetingsScheduled || 0),
      meetingsDone: Number(req.body.meetingsDone || 0),
      ordersClosed: Number(req.body.ordersClosed || 0),
      note: req.body.note || "",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return res.json({ success: true, report });
}

async function listDailyReports(req, res) {
  const reports = await DailyReport.find(req.user.userType === ROLES.ADMIN ? {} : { lrmUserId: req.user._id }).sort({ reportDate: -1 }).limit(120);
  return res.json({ success: true, reports });
}

async function teamPerformance(req, res) {
  const leadFilter = req.user.userType === ROLES.LRM
    ? { $or: [{ assignedByUserId: req.user._id }, { createdByUserId: req.user._id }] }
    : {};
  const reportFilter = req.user.userType === ROLES.LRM ? { lrmUserId: req.user._id } : {};
  const [leads, reports] = await Promise.all([
    Lead.find(leadFilter).select("assignedTo assignedBy assignedToUserId assignedByUserId leadStatus meetingStatus meetingDate"),
    DailyReport.find(reportFilter).sort({ reportDate: -1 }),
  ]);
  const scMap = new Map();
  const lrmMap = new Map();
  leads.forEach((lead) => {
    const scKey = String(lead.assignedToUserId || lead.assignedTo || "unassigned");
    const lrmKey = String(lead.assignedByUserId || lead.assignedBy || "unassigned");
    if (!scMap.has(scKey)) scMap.set(scKey, { name: lead.assignedTo || "Unassigned", totalAssigned: 0, meetingsDone: 0, ordersClosed: 0 });
    if (!lrmMap.has(lrmKey)) lrmMap.set(lrmKey, { name: lead.assignedBy || "Unassigned", totalCalls: 0, connectedCalls: 0, meetingsScheduled: 0, meetingsDone: 0, ordersClosed: 0 });
    const sc = scMap.get(scKey);
    sc.totalAssigned += 1;
    if (lead.meetingStatus === MEETING_STATUSES.DONE) sc.meetingsDone += 1;
    if (lead.leadStatus === LEAD_STATUSES.WON) sc.ordersClosed += 1;
    const lrm = lrmMap.get(lrmKey);
    if (lead.meetingDate) lrm.meetingsScheduled += 1;
    if (lead.meetingStatus === MEETING_STATUSES.DONE) lrm.meetingsDone += 1;
    if (lead.leadStatus === LEAD_STATUSES.WON) lrm.ordersClosed += 1;
  });
  reports.forEach((report) => {
    const key = String(report.lrmUserId);
    if (!lrmMap.has(key)) lrmMap.set(key, { name: report.lrmName, totalCalls: 0, connectedCalls: 0, meetingsScheduled: 0, meetingsDone: 0, ordersClosed: 0 });
    const row = lrmMap.get(key);
    row.totalCalls += report.totalCalls;
    row.connectedCalls += report.connectedCalls;
    row.meetingsScheduled += report.meetingsScheduled;
    row.meetingsDone += report.meetingsDone;
    row.ordersClosed += report.ordersClosed;
  });
  return res.json({
    success: true,
    sc: Array.from(scMap.values()).map((r) => ({ ...r, conversionPercentage: r.totalAssigned ? Math.round((r.ordersClosed / r.totalAssigned) * 100) : 0 })),
    lrm: Array.from(lrmMap.values()).map((r) => ({ ...r, conversionPercentage: r.connectedCalls ? Math.round((r.ordersClosed / r.connectedCalls) * 100) : 0 })),
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
  saveDailyReport,
  listDailyReports,
  teamPerformance,
};
