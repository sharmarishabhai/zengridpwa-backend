const AuditLog = require("../models/AuditLog");
const { ROLES } = require("../utils/constants");

function auditQuery(user) {
  if (user.userType === ROLES.ADMIN) return {};
  return { actorUserId: user._id };
}

async function listAuditLogs(req, res) {
  const query = auditQuery(req.user);
  const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(500);
  return res.json({ success: true, logs });
}

async function getAuditSummary(req, res) {
  const query = auditQuery(req.user);
  const logs = await AuditLog.find(query).select("action entityType createdAt");
  const summary = {
    total: logs.length,
    leadActions: logs.filter((l) => l.entityType === "Lead").length,
    followUpActions: logs.filter((l) => l.entityType === "FollowUp").length,
    meetingActions: logs.filter((l) => l.entityType === "Meeting").length,
    activityActions: logs.filter((l) => ["Quote", "Payment", "GstInvoice"].includes(l.entityType)).length,
  };
  return res.json({ success: true, summary });
}

module.exports = { listAuditLogs, getAuditSummary };
