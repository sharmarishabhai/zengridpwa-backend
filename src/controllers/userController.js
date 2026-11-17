const User = require("../models/User");
const { ROLES } = require("../utils/constants");

async function createTeamUser(req, res) {
  const { userType } = req.body;

  if (![ROLES.LRM, ROLES.LRM_TL, ROLES.SC].includes(userType)) {
    return res.status(400).json({
      success: false,
      message: "Only lrm, lrm_tl or sc can be created by admin",
    });
  }

  const user = await User.create({
    ...req.body,
    reportsToUserId: userType === ROLES.LRM ? (req.body.reportsToUserId || null) : null,
    createdBy: req.user._id,
  });

  return res.status(201).json({ success: true, user });
}

async function listUsers(req, res) {
  const users = await User.find({ userType: { $in: [ROLES.LRM, ROLES.LRM_TL, ROLES.SC] } }).sort({ userType: 1, createdAt: -1 });
  return res.json({ success: true, users });
}

async function listLrms(req, res) {
  const filter =
    req.user.userType === ROLES.ADMIN
      ? { userType: { $in: [ROLES.LRM, ROLES.LRM_TL] } }
      : { userType: ROLES.LRM, reportsToUserId: req.user._id };

  const users = await User.find(filter).sort({ createdAt: -1 });
  return res.json({ success: true, users });
}

async function listScs(req, res) {
  const filter =
    req.user.userType === ROLES.ADMIN
      ? { userType: ROLES.SC }
      : { userType: ROLES.SC };

  const users = await User.find(filter).sort({ createdAt: -1 });
  return res.json({ success: true, users });
}

async function getUserById(req, res) {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (req.user.userType === ROLES.LRM && user.userType === ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  return res.json({ success: true, user });
}

async function updateUser(req, res) {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const allowed = [
    "firstName",
    "lastName",
    "phoneNumber",
    "alternateNumber",
    "email",
    "profileImage",
    "userType",
    "status",
    "password",
    "reportsToUserId",
  ];

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  });

  if (![ROLES.LRM, ROLES.LRM_TL, ROLES.SC].includes(user.userType)) {
    return res.status(400).json({ success: false, message: "Only lrm, lrm_tl or sc can be managed here" });
  }

  if (user.userType !== ROLES.LRM) user.reportsToUserId = null;

  await user.save();
  return res.json({ success: true, user });
}

async function updatePerformanceTarget(req, res) {
  const user = await User.findById(req.params.id);
  if (!user || ![ROLES.LRM, ROLES.LRM_TL].includes(user.userType)) return res.status(404).json({ success: false, message: "LRM not found" });
  if (req.user.userType === ROLES.LRM_TL && String(user.reportsToUserId || "") !== String(req.user._id) && String(user._id) !== String(req.user._id)) return res.status(403).json({ success: false, message: "Only your LRM team can be updated" });
  const fields = ["totalCalls", "meetingsScheduled", "meetingsDone", "ordersClosed"];
  user.performanceTargets = Object.fromEntries(fields.map((field) => [field, Math.max(0, Number(req.body[field] || 0))]));
  await user.save();
  return res.json({ success: true, targets: user.performanceTargets });
}

module.exports = { createTeamUser, listUsers, listLrms, listScs, getUserById, updateUser, updatePerformanceTarget };
