const express = require("express");
const healthRoutes = require("./healthRoutes");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const leadRoutes = require("./leadRoutes");
const followUpRoutes = require("./followUpRoutes");
const activityRoutes = require("./activityRoutes");
const auditRoutes = require("./auditRoutes");
const mediaRoutes = require("./mediaRoutes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/leads", leadRoutes);
router.use("/followups", followUpRoutes);
router.use("/activities", activityRoutes);
router.use("/audits", auditRoutes);
router.use("/media", mediaRoutes);

module.exports = router;
