const express = require("express");
const { contentController } = require("../controller");
const upload = require("../middleware/multer");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

router.post(
  "/add-content",
  upload.single("image"),
  contentController.addContent
);
router.get("/all-content", contentController.showAllContent);
router.get("/my-post", contentController.contentByIdUser);
router.get("/content/:id_content", contentController.getContentById);
router.get("/infinite-scroll", contentController.infiniteScrollContent);

router.post("/edit-content/:id", verifyToken, contentController.editContent);

router.delete(
  "/del-contents/:id",
  verifyToken,
  contentController.deleteContent
);

router.post("/contents/:id/like", verifyToken, contentController.likeContent);
router.post(
  "/contents/:id/comments",
  verifyToken,
  contentController.createComment
);
router.get("/contents/:id/show-comments", contentController.getComments);
router.get("/contents/:id/show-likes", contentController.getLikes);

module.exports = router;
