const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    message: { type: String, default: "" },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorRole: { type: String, default: "" },
  },
  { timestamps: true }
);

auditLogSchema.index({ entityType: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
