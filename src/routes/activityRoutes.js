const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES } = require("../utils/constants");
const {
  addMeeting,
  listMeetings,
  updateMeetingDone,
  addQuote,
  listQuotes,
  addPayment,
  listPayments,
  addGstInvoice,
  listGstInvoices,
  dashboardSummary,
} = require("../controllers/activityController");

const router = express.Router();

router.get("/summary", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(dashboardSummary));

router.post("/meetings/:leadId", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(addMeeting));
router.get("/meetings", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listMeetings));
router.patch("/meetings/:leadId/done", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(updateMeetingDone));

router.post("/quotes/:leadId", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(addQuote));
router.get("/quotes", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listQuotes));

router.post("/payments/:leadId", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(addPayment));
router.get("/payments", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listPayments));

router.post("/gst/:leadId", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(addGstInvoice));
router.get("/gst", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listGstInvoices));

module.exports = router;
