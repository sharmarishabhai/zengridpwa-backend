const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES } = require("../utils/constants");
const { addFollowUp, listFollowUps, listLeadFollowUps } = require("../controllers/followUpController");

const router = express.Router();

router.post("/:leadId", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(addFollowUp));
router.get("/", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listFollowUps));
router.get("/lead/:leadId", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listLeadFollowUps));

module.exports = router;
