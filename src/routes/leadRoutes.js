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
  assignLrmLeads,
  searchLeads,
} = require("../controllers/leadController");

const router = express.Router();

router.post("/", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.LRM_TL), asyncHandler(createLead));
router.get("/", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(listAllLeads));
router.get("/summary", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(leadSummary));
router.post("/import", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(bulkImportLeads));
router.patch("/lrm-assign", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM_TL), asyncHandler(assignLrmLeads));
router.get("/search", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.LRM_TL, ROLES.SC), asyncHandler(searchLeads));
router.get("/mine", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.LRM_TL, ROLES.SC), asyncHandler(listLeads));
router.get("/:id", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.LRM_TL, ROLES.SC), asyncHandler(getLeadById));
router.patch("/:id", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.LRM_TL), asyncHandler(updateLead));
router.patch("/:id/assign", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.LRM_TL), asyncHandler(assignLead));
router.patch("/:id/status", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.LRM_TL, ROLES.SC), asyncHandler(updateLeadStatus));
router.delete("/:id", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.LRM_TL), asyncHandler(deleteLead));

module.exports = router;
