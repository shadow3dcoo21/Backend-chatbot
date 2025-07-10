import express from "express";
import { getQrController } from "../../controllers/messaging/qr.controller.js";
import authenticate from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getQrController);

export default router;
