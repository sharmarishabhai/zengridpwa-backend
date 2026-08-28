const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const asyncHandler = require("../middleware/asyncHandler");
const { protect } = require("../middleware/authMiddleware");
const { uploadSingle, uploadMultiple } = require("../controllers/mediaController");

const router = express.Router();

router.post("/single", protect, upload.single("file"), asyncHandler(uploadSingle));
router.post("/multiple", protect, upload.array("files", 10), asyncHandler(uploadMultiple));

module.exports = router;
