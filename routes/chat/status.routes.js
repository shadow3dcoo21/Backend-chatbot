import express from "express";
const router = express.Router();
import authenticate from "../../middlewares/authMiddleware.js";
import { isClientReady } from "../../services/whatsapp.service.js";

router.get("/", authenticate, (req, res) => {
  const userId = req.user.id;
  const conectado = isClientReady(userId);
  res.json({ conectado });
});

export default router;
