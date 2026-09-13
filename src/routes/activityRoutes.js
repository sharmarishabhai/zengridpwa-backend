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
  saveDailyReport,
  listDailyReports,
  teamPerformance,
} = require("../controllers/activityController");

const router = express.Router();

router.get("/summary", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(dashboardSummary));

router.get("/performance", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(teamPerformance));
router.post("/daily-reports", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(saveDailyReport));
router.get("/daily-reports", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(listDailyReports));

router.post("/meetings/:leadId", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(addMeeting));
router.get("/meetings", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listMeetings));
router.patch("/meetings/:leadId/done", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(updateMeetingDone));

router.post("/quotes/:leadId", protect, authorizeRoles(ROLES.ADMIN, ROLES.SC), asyncHandler(addQuote));
router.get("/quotes", protect, authorizeRoles(ROLES.ADMIN, ROLES.SC), asyncHandler(listQuotes));

router.post("/payments/:leadId", protect, authorizeRoles(ROLES.ADMIN, ROLES.SC), asyncHandler(addPayment));
router.get("/payments", protect, authorizeRoles(ROLES.ADMIN, ROLES.SC), asyncHandler(listPayments));

router.post("/gst/:leadId", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(addGstInvoice));
router.get("/gst", protect, authorizeRoles(ROLES.ADMIN, ROLES.SC), asyncHandler(listGstInvoices));

module.exports = router;
