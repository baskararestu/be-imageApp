const express = require("express");
const { contentController } = require("../controller");
const upload = require("../middleware/multer");
const { verifyToken } = require("../middleware/auth");
const { deleteContent } = require("../controller/content.controller");
const router = express.Router();

router.post(
  "/add-content",
  upload.single("image"),
  contentController.addContent
);
router.get("/all-content", verifyToken, contentController.showAllContent);
router.post(
  "/edit-content",
  verifyToken,
  upload.single("image"),
  contentController.editContent
);

router.delete("/del-contents/:id", verifyToken, deleteContent);

module.exports = router;
