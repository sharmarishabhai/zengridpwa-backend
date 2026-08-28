const express = require("express");
const {
  createTeamUser,
  listUsers,
  listLrms,
  listScs,
  getUserById,
  updateUser,
} = require("../controllers/userController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES } = require("../utils/constants");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.post("/", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(createTeamUser));
router.get("/", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(listUsers));
router.get("/lrms", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(listLrms));
router.get("/scs", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(listScs));
router.get("/:id", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM), asyncHandler(getUserById));
router.patch("/:id", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(updateUser));

module.exports = router;
