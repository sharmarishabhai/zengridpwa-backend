const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { signAccessToken, signRefreshToken } = require("../utils/token");
const { STATUSES } = require("../utils/constants");

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const validPassword = await user.comparePassword(password);
  if (!validPassword) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  if (user.status !== STATUSES.ACTIVE) {
    return res.status(403).json({ success: false, message: "Account is not active" });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken({ id: user._id, role: user.userType });
  const refreshToken = signRefreshToken({ id: user._id, role: user.userType });
  return res.json({
    success: true,
    accessToken,
    refreshToken,
    user: user.toJSON(),
  });
}

async function getMe(req, res) {
  return res.json({ success: true, user: req.user.toJSON() });
}

async function refreshToken(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: "refreshToken is required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (user.status !== STATUSES.ACTIVE) {
      return res.status(403).json({ success: false, message: "Account is not active" });
    }

    const accessToken = signAccessToken({ id: user._id, role: user.userType });
    return res.json({ success: true, accessToken });
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
}

module.exports = { login, getMe, refreshToken };
