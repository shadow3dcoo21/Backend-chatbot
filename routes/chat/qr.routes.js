const express = require("express");
const router = express.Router();
const { getQrController } = require("../../controllers/messaging/qr.controller");
const authenticate = require("../../middlewares/authMiddleware");

router.get("/", authenticate, getQrController);

module.exports = router;
