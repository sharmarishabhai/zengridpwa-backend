const Lead = require("../models/Lead");
const FollowUp = require("../models/FollowUp");
const Meeting = require("../models/Meeting");
const Quote = require("../models/Quote");
const Payment = require("../models/Payment");
const GstInvoice = require("../models/GstInvoice");
const User = require("../models/User");
const { ROLES } = require("../utils/constants");
const { LEAD_STATUSES, LRM_LEAD_STATUSES, MEETING_STATUSES, SOURCES } = require("../utils/leadConstants");
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
    lrmStatus: body.lrmStatus || body.LrmStatus || body.Quality || LRM_LEAD_STATUSES.NEW,
    followUpDate: body.followUpDate || body.FollowUpDate || "",
    assignedTo: body.assignedTo || body.AssignedTo || "",
    assignedBy: body.assignedBy || body.AssignedBy || "",
    assignedToUserId: body.assignedToUserId || body.AssignedToUserId || null,
    assignedByUserId: body.assignedByUserId || body.AssignedByUserId || null,
    lrmAssignedToUserId: body.lrmAssignedToUserId || body.LrmAssignedToUserId || null,
    meetingDate: body.meetingDate || body.MeetingDate || "",
    meetingTime: body.meetingTime || body.MeetingTime || "",
    meetingStatus: body.meetingStatus || body.MeetingStatus || MEETING_STATUSES.ASSIGNED,
    note: body.note || body.Notes || "",
  };
}

function paginationOptions(query) {
  const page = Math.max(1, Number(query.page || 1));
  // Lead workspaces load the complete operational list; keep pagination available for larger datasets.
  const limit = Math.min(5000, Math.max(1, Number(query.limit || 25)));
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
  if (user.userType === ROLES.LRM) return String(lead.lrmAssignedToUserId || lead.assignedByUserId || "") === String(user._id) || String(lead.createdByUserId || "") === String(user._id);
  if (user.userType === ROLES.LRM_TL) return true;
  if (user.userType === ROLES.SC) return String(lead.assignedToUserId || "") === String(user._id);
  return false;
}

function canManageLeadAssignment(user, lead) {
  if (user.userType === ROLES.ADMIN || user.userType === ROLES.LRM_TL) return true;
  if (user.userType === ROLES.LRM) {
    // Support both the current assignment fields and older imported leads.
    return String(lead.lrmAssignedToUserId || lead.assignedByUserId || lead.createdByUserId || "") === String(user._id);
  }
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
  // LRMs can see the shared lead directory; mutation endpoints still enforce ownership.
  if (req.user.userType === ROLES.LRM) filter = { $or: [{ lrmAssignedToUserId: req.user._id }, { assignedByUserId: req.user._id }, { createdByUserId: req.user._id }] };
  if (req.user.userType === ROLES.LRM_TL) {
    const lrmUsers = await User.find({ userType: ROLES.LRM, reportsToUserId: req.user._id }).select("_id").lean();
    const lrmIds = lrmUsers.map((user) => user._id);
    filter = {};
    if (req.query.lrmAssignedToUserId && lrmIds.some((id) => String(id) === String(req.query.lrmAssignedToUserId))) filter.$or = [{ lrmAssignedToUserId: req.query.lrmAssignedToUserId }, { assignedByUserId: req.query.lrmAssignedToUserId }];
    if (req.query.assignment === "unassigned") filter.$and = [{ $or: [{ lrmAssignedToUserId: null }, { lrmAssignedToUserId: { $exists: false } }] }, { $or: [{ assignedByUserId: null }, { assignedByUserId: { $exists: false } }] }];
    if (req.query.assignment === "assigned") filter.$or = [{ lrmAssignedToUserId: { $in: lrmIds } }, { assignedByUserId: { $in: lrmIds } }];
    if (req.query.assignment !== "unassigned" && req.query.assignment !== "assigned" && !req.query.lrmAssignedToUserId) delete filter.$and;
  }
  if (req.user.userType === ROLES.SC) {
    const fullName = `${req.user.firstName} ${req.user.lastName}`.trim();
    filter = { $or: [{ assignedToUserId: req.user._id }, { assignedTo: new RegExp(`^${fullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }] };
  }
  if (req.user.userType === ROLES.LRM_TL) {
    if (req.query.lrmStatus) filter.lrmStatus = req.query.lrmStatus;
    if (req.query.q) {
      const regex = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$and = [...(filter.$and || []), { $or: [{ customerName: regex }, { leadId: regex }, { phone: regex }, { email: regex }, { source: regex }] }];
    }
  }
  if (req.query.unassignedSc === "true") {
    filter.$and = [...(filter.$and || []), { $or: [{ assignedToUserId: null }, { assignedToUserId: { $exists: false } }] }, { $or: [{ assignedTo: null }, { assignedTo: "" }, { assignedTo: { $exists: false } }] }, { lrmStatus: LRM_LEAD_STATUSES.NEW }];
    if (req.user.userType === ROLES.LRM_TL) {
      const team = await User.find({ userType: ROLES.LRM, reportsToUserId: req.user._id }).select("_id").lean();
      const teamIds = team.map((user) => user._id);
      filter.$and.push({ $or: [{ lrmAssignedToUserId: { $in: teamIds } }, { assignedByUserId: { $in: teamIds } }] });
    }
  }
  if (req.query.meetingDate) filter.meetingDate = req.query.meetingDate;
  const [leads, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Lead.countDocuments(filter),
  ]);
  const lrmIds = [...new Set(leads.map((lead) => String(lead.lrmAssignedToUserId || lead.assignedByUserId || "")).filter(Boolean))];
  if (lrmIds.length) {
    const lrmUsers = await User.find({ _id: { $in: lrmIds }, userType: ROLES.LRM }).select("firstName lastName").lean();
    const lrmMap = new Map(lrmUsers.map((user) => [String(user._id), `${user.firstName} ${user.lastName}`.trim()]));
    leads.forEach((lead) => {
      const ownerId = String(lead.lrmAssignedToUserId || lead.assignedByUserId || "");
      const ownerName = lrmMap.get(ownerId);
      if (ownerName) { lead.assignedBy = ownerName; lead.assignedByUserId = lead.lrmAssignedToUserId || lead.assignedByUserId; }
    });
  }
  return res.json({ success: true, leads, pagination: paginationMeta(total, page, limit) });
}

async function listAllLeads(req, res) {
  const { page, limit, skip } = paginationOptions(req.query);
  const filter = buildLeadFilter(req.query);
  const [leads, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Lead.countDocuments(filter),
  ]);
  return res.json({ success: true, leads, pagination: paginationMeta(total, page, limit) });
}

function buildLeadFilter(query = {}) {
  const filter = {};
  const exact = { leadStatus: "status", source: "source", assignedToUserId: "assignedToUserId", assignedByUserId: "assignedByUserId", meetingStatus: "meetingStatus" };
  Object.entries(exact).forEach(([field, key]) => {
    if (!query[key]) return;
    if (field === "assignedByUserId") {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
        { assignedByUserId: query[key] },
        { lrmAssignedToUserId: query[key] },
          ],
        },
      ];
      return;
    }
    filter[field] = query[key];
  });
  if (query.hasMeeting === "true") filter.meetingDate = { $nin: [null, ""] };
  if (query.hasFollowUp === "true") filter.followUpDate = { $nin: [null, ""] };
  if (query.unassignedSc === "true") {
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ assignedToUserId: null }, { assignedToUserId: { $exists: false } }] },
      { $or: [{ assignedTo: null }, { assignedTo: "" }, { assignedTo: { $exists: false } }] },
      { lrmStatus: LRM_LEAD_STATUSES.NEW },
    ];
  }
  if (query.meetingDateFrom || query.meetingDateTo) filter.meetingDate = { ...(filter.meetingDate || {}), ...(query.meetingDateFrom ? { $gte: query.meetingDateFrom } : {}), ...(query.meetingDateTo ? { $lte: query.meetingDateTo } : {}) };
  if (query.followUpDateFrom || query.followUpDateTo) filter.followUpDate = { ...(filter.followUpDate || {}), ...(query.followUpDateFrom ? { $gte: query.followUpDateFrom } : {}), ...(query.followUpDateTo ? { $lte: query.followUpDateTo } : {}) };
  if (query.q) {
    const regex = new RegExp(String(query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ customerName: regex }, { leadId: regex }, { phone: regex }, { whatsappNumber: regex }, { email: regex }, { area: regex }, { locality: regex }];
  }
  return filter;
}

async function getLeadById(req, res) {
  const lead = await Lead.findById(req.params.id).lean();
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
  // PATCH payloads are partial. Do not let fields omitted by a status/edit
  // workflow become null and erase an existing LRM/SC assignment.
  if (!Object.prototype.hasOwnProperty.call(req.body, "assignedByUserId") && !Object.prototype.hasOwnProperty.call(req.body, "AssignedByUserId")) {
    delete payload.assignedByUserId;
    delete payload.assignedBy;
  }
  if (!Object.prototype.hasOwnProperty.call(req.body, "lrmAssignedToUserId") && !Object.prototype.hasOwnProperty.call(req.body, "LrmAssignedToUserId")) delete payload.lrmAssignedToUserId;
  if (!Object.prototype.hasOwnProperty.call(req.body, "assignedToUserId") && !Object.prototype.hasOwnProperty.call(req.body, "AssignedToUserId")) delete payload.assignedToUserId;
  if (payload.assignedByUserId) {
    const assignedByUser = await User.findById(payload.assignedByUserId).select("firstName lastName userType reportsToUserId");
    if (!assignedByUser || assignedByUser.userType !== ROLES.LRM) {
      return res.status(400).json({ success: false, message: "Assigned By must be an LRM user" });
    }
    if (req.user.userType === ROLES.LRM_TL && String(assignedByUser.reportsToUserId || "") !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can assign only to LRMs in your team" });
    }
    payload.assignedBy = `${assignedByUser.firstName} ${assignedByUser.lastName}`.trim();
  }
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
  if (!canManageLeadAssignment(req.user, lead)) {
    return res.status(403).json({ success: false, message: "You can assign only leads owned by your LRM account" });
  }
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
    const assignee = await User.findOne({
      userType: ROLES.SC,
      $expr: { $regexMatch: { input: { $trim: { input: { $concat: ["$firstName", " ", "$lastName"] } } }, regex: `^${String(assignedTo).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, options: "i" } },
    });
    if (assignee) {
      lead.assignedTo = `${assignee.firstName} ${assignee.lastName}`.trim();
      lead.assignedToUserId = assignee._id;
    } else {
      lead.assignedTo = assignedTo || lead.assignedTo;
    }
  }
  // assignedByUserId is the LRM owner used by older clients and reports.
  // Do not replace it with the user who assigned the SC.
  if (!lead.lrmAssignedToUserId) {
    lead.lrmAssignedToUserId = lead.assignedByUserId || req.user._id;
  }
  if (!lead.assignedByUserId) lead.assignedByUserId = lead.lrmAssignedToUserId;
  if (!lead.assignedBy) {
    lead.assignedBy = `${req.user.firstName} ${req.user.lastName}`.trim();
  }
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
  const { leadStatus, lrmStatus, meetingStatus, followUpDate, note } = req.body;
  if (!canSeeLead(req.user, lead)) return res.status(403).json({ success: false, message: "Forbidden" });
  if (leadStatus) lead.leadStatus = leadStatus;
  if (lrmStatus) lead.lrmStatus = lrmStatus;
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

  // Reject binary/XML content accidentally sent by an old importer. Valid
  // names and phone numbers must not contain replacement or control chars.
  const looksBinary = (value) => /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/.test(String(value || ""));
  const binaryRow = leads.find((item) => looksBinary(item?.customerName) || looksBinary(item?.phone));
  if (binaryRow) {
    return res.status(400).json({
      success: false,
      message: "Invalid lead data detected. Please refresh the admin app and upload the original CSV/XLSX file again.",
    });
  }

  // Bulk import intentionally accepts only the two identity fields. All
  // operational/customer details are completed later through lead editing.
  const normalized = leads.map((item) => {
    const payload = toLeadPayload(item);
    return { customerName: String(payload.customerName || "").trim(), phone: String(payload.phone || "").trim() };
  });
  const phones = normalized.map((l) => l.phone).filter(Boolean);
  const existing = await Lead.find({ phone: { $in: phones } }).select("phone");
  const existingSet = new Set(existing.map((x) => x.phone));

  const invalid = normalized.filter((l) => !l.customerName || !l.phone);
  const toCreate = normalized.filter((l) => l.customerName && l.phone && !existingSet.has(l.phone));
  const duplicates = normalized.filter((l) => l.phone && existingSet.has(l.phone));

  const created = await Lead.insertMany(
    toCreate.map((l) => ({
      ...l,
      createdByRole: req.user.userType,
      createdByUserId: req.user._id,
      updatedByUserId: req.user._id,
      lrmAssignedToUserId: null,
      lrmAssignedByUserId: null,
      leadId: `ZN${Math.floor(100000 + Math.random() * 900000)}`,
    })),
    { ordered: false }
  ).catch(() => []);

  return res.status(201).json({
    success: true,
    imported: created.length,
    skipped: duplicates.length,
    invalid: invalid.length,
    duplicates,
    leads: created,
  });
}

async function assignLrmLeads(req, res) {
  const { leadIds, lrmUserId } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length || !lrmUserId) return res.status(400).json({ success: false, message: "leadIds and lrmUserId are required" });
  const assignee = await User.findById(lrmUserId);
  if (!assignee || ![ROLES.LRM, ROLES.LRM_TL].includes(assignee.userType)) return res.status(400).json({ success: false, message: "Select an LRM or LRM Team Lead" });
  if (req.user.userType === ROLES.LRM_TL && assignee.userType === ROLES.LRM && String(assignee.reportsToUserId || "") !== String(req.user._id)) return res.status(403).json({ success: false, message: "You can assign only to LRMs in your team" });
  const result = await Lead.updateMany({ _id: { $in: leadIds } }, { $set: { lrmAssignedToUserId: assignee._id, lrmAssignedByUserId: req.user._id, assignedByUserId: assignee._id, assignedBy: `${assignee.firstName} ${assignee.lastName}`.trim(), updatedByUserId: req.user._id } });
  return res.json({ success: true, assigned: result.modifiedCount });
}

async function searchLeads(req, res) {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ success: true, leads: [] });
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const filter = req.user.userType === ROLES.ADMIN
    ? { $or: [{ customerName: regex }, { phone: regex }, { whatsappNumber: regex }, { email: regex }, { area: regex }, { locality: regex }] }
    : {
        $and: [
          req.user.userType === ROLES.LRM
            ? { $or: [{ lrmAssignedToUserId: req.user._id }, { assignedByUserId: req.user._id }, { createdByUserId: req.user._id }] }
            : { assignedToUserId: req.user._id },
          { $or: [{ customerName: regex }, { phone: regex }, { whatsappNumber: regex }, { email: regex }, { area: regex }, { locality: regex }] },
        ],
      };
  const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
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
  assignLrmLeads,
  searchLeads,
};
