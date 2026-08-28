const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES } = require("../utils/constants");
const { listAuditLogs, getAuditSummary } = require("../controllers/auditController");

const router = express.Router();

router.get("/summary", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(getAuditSummary));
router.get("/", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listAuditLogs));

module.exports = router;
