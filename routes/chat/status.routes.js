import express from "express";
const router = express.Router();
import authenticate from "../../middlewares/authMiddleware.js";
import { isClientReady } from "../../services/whatsapp.service.js";

router.get("/:companyId", authenticate, (req, res) => {
  const companyId = req.params.companyId;
  const conectado = isClientReady(companyId);
  res.json({ conectado });
});

export default router;
