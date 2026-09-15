const Lead = require("../models/Lead");
const FollowUp = require("../models/FollowUp");
const Meeting = require("../models/Meeting");
const Quote = require("../models/Quote");
const Payment = require("../models/Payment");
const GstInvoice = require("../models/GstInvoice");
const User = require("../models/User");
const { ROLES } = require("../utils/constants");
const { LEAD_STATUSES, MEETING_STATUSES, SOURCES } = require("../utils/leadConstants");
const { logAudit } = require("../utils/audit");

function toLeadPayload(body) {
  return {
    customerName: body.customerName || body.Name || "",
    phone: body.phone || body.Phone || "",
    whatsappNumber: body.whatsappNumber || body.WhatsApp || body.whatsapp || "",
    email: body.email || body.Email || "",
    address: body.address || body.Address || "",
    area: body.area || body.Area || "",
    locality: body.locality || body.Locality || "",
    monthlyBill: Number(body.monthlyBill || body.Bill || 0),
    source: body.source || body.Source || SOURCES.WEBSITE,
    leadStatus: body.leadStatus || body.Status || LEAD_STATUSES.NEW,
    followUpDate: body.followUpDate || body.FollowUpDate || "",
    assignedTo: body.assignedTo || body.AssignedTo || "",
    assignedBy: body.assignedBy || body.AssignedBy || "",
    assignedToUserId: body.assignedToUserId || body.AssignedToUserId || null,
    assignedByUserId: body.assignedByUserId || body.AssignedByUserId || null,
    meetingDate: body.meetingDate || body.MeetingDate || "",
    meetingTime: body.meetingTime || body.MeetingTime || "",
    meetingStatus: body.meetingStatus || body.MeetingStatus || MEETING_STATUSES.ASSIGNED,
    note: body.note || body.Notes || "",
  };
}

function paginationOptions(query) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
  return { page, limit, skip: (page - 1) * limit };
}

function paginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function makeLeadId() {
  for (let i = 0; i < 12; i += 1) {
    const leadId = `ZN${Math.floor(100000 + Math.random() * 900000)}`;
    const exists = await Lead.exists({ leadId });
    if (!exists) return leadId;
  }
  return `ZN${Date.now().toString().slice(-6)}`;
}

function canSeeLead(user, lead) {
  if (user.userType === ROLES.ADMIN) return true;
  if (user.userType === ROLES.LRM) return String(lead.assignedByUserId || "") === String(user._id) || String(lead.createdByUserId || "") === String(user._id);
  if (user.userType === ROLES.SC) return String(lead.assignedToUserId || "") === String(user._id);
  return false;
}

async function createLead(req, res) {
  const payload = toLeadPayload(req.body);
  if (!payload.customerName || !payload.phone) {
    return res.status(400).json({ success: false, message: "customerName and phone are required" });
  }

  let assignedByUser = null;
  let assignedToUser = null;

  if (req.user.userType === ROLES.ADMIN) {
    if (!payload.assignedByUserId) {
      return res.status(400).json({ success: false, message: "assignedByUserId LRM is required" });
    }
    assignedByUser = await User.findById(payload.assignedByUserId);
    if (!assignedByUser || assignedByUser.userType !== ROLES.LRM) {
      return res.status(400).json({ success: false, message: "Assigned By must be an LRM user" });
    }
  }

  if (req.user.userType === ROLES.LRM) {
    assignedByUser = req.user;
  }

  if (payload.assignedToUserId) {
    assignedToUser = await User.findById(payload.assignedToUserId);
    if (!assignedToUser || assignedToUser.userType !== ROLES.SC) {
      return res.status(400).json({ success: false, message: "Assigned To must be an SC user" });
    }
  }

  const existing = await Lead.findOne({ phone: payload.phone });
  if (existing) {
    return res.status(409).json({ success: false, message: "phone already exists" });
  }

  const lead = await Lead.create({
    ...payload,
    assignedBy: assignedByUser ? `${assignedByUser.firstName} ${assignedByUser.lastName}`.trim() : payload.assignedBy,
    assignedByUserId: assignedByUser?._id || payload.assignedByUserId || null,
    assignedTo: assignedToUser ? `${assignedToUser.firstName} ${assignedToUser.lastName}`.trim() : "",
    assignedToUserId: assignedToUser?._id || null,
    leadId: await makeLeadId(),
    createdByRole: req.user.userType,
    createdByUserId: req.user._id,
    updatedByUserId: req.user._id,
  });

  await logAudit({
    action: "lead.create",
    entityType: "Lead",
    entityId: lead._id,
    message: `Lead created for ${lead.customerName}`,
    after: lead.toJSON(),
    actorUserId: req.user._id,
    actorRole: req.user.userType,
  });

  return res.status(201).json({ success: true, lead });
}

async function listLeads(req, res) {
  const { page, limit, skip } = paginationOptions(req.query);
  let filter = {};
  if (req.user.userType === ROLES.LRM) filter = { assignedByUserId: req.user._id };
  if (req.user.userType === ROLES.SC) filter = { assignedToUserId: req.user._id };
  if (req.query.meetingDate) filter.meetingDate = req.query.meetingDate;
  const [leads, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Lead.countDocuments(filter),
  ]);
  return res.json({ success: true, leads, pagination: paginationMeta(total, page, limit) });
}

async function listAllLeads(req, res) {
  const { page, limit, skip } = paginationOptions(req.query);
  const [leads, total] = await Promise.all([
    Lead.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Lead.countDocuments({}),
  ]);
  return res.json({ success: true, leads, pagination: paginationMeta(total, page, limit) });
}

async function getLeadById(req, res) {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  if (!canSeeLead(req.user, lead)) return res.status(403).json({ success: false, message: "Forbidden" });
  return res.json({ success: true, lead });
}

async function updateLead(req, res) {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  if (req.user.userType !== ROLES.ADMIN && !canSeeLead(req.user, lead)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  const before = lead.toJSON();
  const payload = toLeadPayload(req.body);
  Object.keys(payload).forEach((k) => {
    if (payload[k] !== undefined && payload[k] !== "") lead[k] = payload[k];
  });
  lead.updatedByUserId = req.user._id;
  await lead.save();
  await logAudit({
    action: "lead.update",
    entityType: "Lead",
    entityId: lead._id,
    message: `Lead updated: ${lead.customerName}`,
    before,
    after: lead.toJSON(),
    actorUserId: req.user._id,
    actorRole: req.user.userType,
  });
  return res.json({ success: true, lead });
}

async function assignLead(req, res) {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  const before = lead.toJSON();
  const { assignedTo, assignedToUserId, meetingDate, meetingTime } = req.body;
  if (!assignedTo && !assignedToUserId) {
    return res.status(400).json({ success: false, message: "assignedTo or assignedToUserId is required" });
  }
  if (assignedToUserId) {
    const assignee = await require("../models/User").findById(assignedToUserId);
    if (!assignee || assignee.userType !== ROLES.SC) {
      return res.status(400).json({ success: false, message: "Lead can only be assigned to an SC user" });
    }
    lead.assignedTo = `${assignee.firstName} ${assignee.lastName}`.trim();
    lead.assignedToUserId = assignee._id;
  } else {
    lead.assignedTo = assignedTo || lead.assignedTo;
  }
  lead.assignedBy = `${req.user.firstName} ${req.user.lastName}`.trim();
  lead.assignedByUserId = req.user._id;
  if (meetingDate !== undefined) lead.meetingDate = meetingDate;
  if (meetingTime !== undefined) lead.meetingTime = meetingTime;
  if (!lead.meetingStatus) lead.meetingStatus = MEETING_STATUSES.ASSIGNED;
  lead.updatedByUserId = req.user._id;
  await lead.save();
  await logAudit({
    action: "lead.assign",
    entityType: "Lead",
    entityId: lead._id,
    message: `Lead assigned to ${lead.assignedTo || "user"}`,
    before,
    after: lead.toJSON(),
    actorUserId: req.user._id,
    actorRole: req.user.userType,
  });
  return res.json({ success: true, lead });
}

async function updateLeadStatus(req, res) {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  const before = lead.toJSON();
  const { leadStatus, meetingStatus, followUpDate, note } = req.body;
  if (!canSeeLead(req.user, lead)) return res.status(403).json({ success: false, message: "Forbidden" });
  if (leadStatus) lead.leadStatus = leadStatus;
  if (meetingStatus) lead.meetingStatus = meetingStatus;
  if (followUpDate !== undefined) lead.followUpDate = followUpDate;
  if (note !== undefined) lead.note = note;
  lead.updatedByUserId = req.user._id;
  await lead.save();
  await logAudit({
    action: "lead.status",
    entityType: "Lead",
    entityId: lead._id,
    message: `Lead status updated to ${lead.leadStatus}`,
    before,
    after: lead.toJSON(),
    actorUserId: req.user._id,
    actorRole: req.user.userType,
  });
  return res.json({ success: true, lead });
}

async function deleteLead(req, res) {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

  const before = lead.toJSON();
  await Lead.deleteOne({ _id: lead._id });
  await FollowUp.deleteMany({ leadId: lead._id });
  await Meeting.deleteMany({ leadId: lead._id });
  await Quote.deleteMany({ leadId: lead._id });
  await Payment.deleteMany({ leadId: lead._id });
  await GstInvoice.deleteMany({ leadId: lead._id });

  await logAudit({
    action: "lead.delete",
    entityType: "Lead",
    entityId: lead._id,
    message: `Lead deleted: ${lead.customerName}`,
    before,
    actorUserId: req.user._id,
    actorRole: req.user.userType,
  });

  return res.json({ success: true, message: "Lead deleted" });
}

async function bulkImportLeads(req, res) {
  const leads = Array.isArray(req.body.leads) ? req.body.leads : [];
  if (!leads.length) return res.status(400).json({ success: false, message: "leads array is required" });

  const normalized = leads.map((item) => toLeadPayload(item));
  const phones = normalized.map((l) => l.phone).filter(Boolean);
  const existing = await Lead.find({ phone: { $in: phones } }).select("phone");
  const existingSet = new Set(existing.map((x) => x.phone));

  const toCreate = normalized.filter((l) => l.customerName && l.phone && !existingSet.has(l.phone));
  const duplicates = normalized.filter((l) => l.phone && existingSet.has(l.phone));

  const created = await Lead.insertMany(
    toCreate.map((l) => ({
      ...l,
      createdByRole: req.user.userType,
      createdByUserId: req.user._id,
      updatedByUserId: req.user._id,
      leadId: `ZN${Math.floor(100000 + Math.random() * 900000)}`,
    })),
    { ordered: false }
  ).catch(() => []);

  return res.status(201).json({
    success: true,
    imported: created.length,
    skipped: duplicates.length,
    duplicates,
    leads: created,
  });
}

async function searchLeads(req, res) {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ success: true, leads: [] });
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const filter = req.user.userType === ROLES.ADMIN
    ? { $or: [{ customerName: regex }, { phone: regex }, { whatsappNumber: regex }, { email: regex }, { area: regex }, { locality: regex }] }
    : {
        $and: [
          req.user.userType === ROLES.LRM ? { assignedByUserId: req.user._id } : { assignedToUserId: req.user._id },
          { $or: [{ customerName: regex }, { phone: regex }, { whatsappNumber: regex }, { email: regex }, { area: regex }, { locality: regex }] },
        ],
      };
  const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(100);
  return res.json({ success: true, leads });
}

async function leadSummary(req, res) {
  const leads = await Lead.find({}).select("leadStatus");
  const followUps = await FollowUp.find({}).select("followUpDate");
  const today = new Date().toISOString().slice(0, 10);

  const summary = {
    totalLeads: leads.length,
    totalFollowUps: followUps.length,
    followUpsToday: followUps.filter((f) => f.followUpDate === today).length,
    overdueFollowUps: followUps.filter((f) => f.followUpDate && f.followUpDate < today).length,
    won: leads.filter((l) => l.leadStatus === "Won").length,
    interested: leads.filter((l) => l.leadStatus === "Interested").length,
  };

  return res.json({ success: true, summary });
}

module.exports = {
  createLead,
  listLeads,
  listAllLeads,
  getLeadById,
  updateLead,
  assignLead,
  updateLeadStatus,
  deleteLead,
  leadSummary,
  bulkImportLeads,
  searchLeads,
};
