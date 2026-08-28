const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { STATUSES } = require("../utils/constants");

async function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Not authorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (user.status !== STATUSES.ACTIVE) {
      return res.status(403).json({ success: false, message: "Account is not active" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.userType)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}

module.exports = { protect, authorizeRoles };
