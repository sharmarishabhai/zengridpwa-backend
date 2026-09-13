const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { ROLES } = require("../utils/constants");
const {
  listConfigItems,
  listResource,
  createResource,
  updateResource,
  deleteResource,
} = require("../controllers/configController");

const router = express.Router();

router.get("/", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listConfigItems));
router.get("/:resource", protect, authorizeRoles(ROLES.ADMIN, ROLES.LRM, ROLES.SC), asyncHandler(listResource));
router.post("/:resource", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(createResource));
router.patch("/:resource/:id", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(updateResource));
router.delete("/:resource/:id", protect, authorizeRoles(ROLES.ADMIN), asyncHandler(deleteResource));

module.exports = router;
