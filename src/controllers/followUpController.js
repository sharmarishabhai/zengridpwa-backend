const FollowUp = require("../models/FollowUp");
const Lead = require("../models/Lead");
const { ROLES } = require("../utils/constants");
const { LEAD_STATUSES } = require("../utils/leadConstants");

function canSeeLead(user, lead) {
  if (user.userType === ROLES.ADMIN) return true;
  if (user.userType === ROLES.LRM) return String(lead.assignedByUserId || "") === String(user._id) || String(lead.createdByUserId || "") === String(user._id);
  if (user.userType === ROLES.SC) return String(lead.assignedToUserId || "") === String(user._id);
  return false;
}

async function addFollowUp(req, res) {
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  if (!canSeeLead(req.user, lead) && req.user.userType !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const { followUpDate, followUpTime, note, status } = req.body;
  if (!followUpDate) {
    return res.status(400).json({ success: false, message: "followUpDate is required" });
  }

  const followUp = await FollowUp.create({
    leadId: lead._id,
    leadName: lead.customerName,
    phone: lead.phone,
    assignedTo: lead.assignedTo,
    assignedBy: lead.assignedBy,
    assignedToUserId: lead.assignedToUserId,
    assignedByUserId: lead.assignedByUserId || req.user._id,
    followUpDate,
    followUpTime: followUpTime || "",
    status: status || LEAD_STATUSES.FOLLOW_UP,
    note: note || "",
    createdByUserId: req.user._id,
  });

  lead.followUpDate = followUpDate;
  if (status) lead.leadStatus = status;
  if (note) lead.note = lead.note ? `${lead.note}\n[FollowUp] ${note}` : `[FollowUp] ${note}`;
  await lead.save();

  return res.status(201).json({ success: true, followUp, lead });
}

async function listFollowUps(req, res) {
  const query = {};
  if (req.user.userType === ROLES.LRM) query.assignedByUserId = req.user._id;
  if (req.user.userType === ROLES.SC) query.assignedToUserId = req.user._id;
  const followUps = await FollowUp.find(query).sort({ followUpDate: 1, createdAt: -1 });
  return res.json({ success: true, followUps });
}

async function listLeadFollowUps(req, res) {
  const lead = await Lead.findById(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
  if (!canSeeLead(req.user, lead) && req.user.userType !== ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const followUps = await FollowUp.find({ leadId: lead._id }).sort({ followUpDate: 1, createdAt: -1 });
  return res.json({ success: true, followUps });
}

module.exports = { addFollowUp, listFollowUps, listLeadFollowUps };
