const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES } = require("../utils/constants");
const {
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
} = require("../controllers/leadController");

const router = express.Router();

router.post("/", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(createLead));
router.get("/", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(listAllLeads));
router.get("/summary", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(leadSummary));
router.post("/import", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(bulkImportLeads));
router.get("/search", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(searchLeads));
router.get("/mine", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listLeads));
router.get("/:id", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(getLeadById));
router.patch("/:id", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(updateLead));
router.patch("/:id/assign", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(assignLead));
router.patch("/:id/status", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(updateLeadStatus));
router.delete("/:id", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(deleteLead));

module.exports = router;
