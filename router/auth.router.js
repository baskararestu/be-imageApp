const express = require("express");
const { authController } = require("../controller");
const upload = require("../middleware/multer");
const router = express.Router();

router.post("/login", authController.login);
router.post("/", authController.CreateUser);
router.post("/verification", authController.verification);
router.get("/get-user", authController.fetchUserById);
router.post("/edit-user", upload.single("image"), authController.editUserById);

module.exports = router;
