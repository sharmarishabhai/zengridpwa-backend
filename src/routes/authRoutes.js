const express = require("express");
const { login, getMe, refreshToken } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refreshToken));
router.get("/me", protect, asyncHandler(getMe));

module.exports = router;
