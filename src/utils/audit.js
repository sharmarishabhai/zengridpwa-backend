const AuditLog = require("../models/AuditLog");

async function logAudit({ action, entityType, entityId = null, message = "", before = null, after = null, actorUserId, actorRole = "" }) {
  try {
    await AuditLog.create({
      action,
      entityType,
      entityId,
      message,
      before,
      after,
      actorUserId,
      actorRole,
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
}

module.exports = { logAudit };
