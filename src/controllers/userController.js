const User = require("../models/User");
const { ROLES } = require("../utils/constants");

async function createTeamUser(req, res) {
  const { userType } = req.body;

  if (![ROLES.LRM, ROLES.SC].includes(userType)) {
    return res.status(400).json({
      success: false,
      message: "Only lrm or sc can be created by admin",
    });
  }

  const user = await User.create({
    ...req.body,
    createdBy: req.user._id,
  });

  return res.status(201).json({ success: true, user });
}

async function listUsers(req, res) {
  const users = await User.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
  return res.json({ success: true, users });
}

async function listLrms(req, res) {
  const filter =
    req.user.userType === ROLES.ADMIN
      ? { userType: ROLES.LRM }
      : { userType: ROLES.LRM, createdBy: req.user._id };

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
  ];

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  });

  await user.save();
  return res.json({ success: true, user });
}

module.exports = { createTeamUser, listUsers, listLrms, listScs, getUserById, updateUser };
