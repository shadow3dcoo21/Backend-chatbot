  const express = require("express");
  const router = express.Router();
  const authenticate = require("../../middlewares/authMiddleware");
  const { isClientReady } = require("../../services/whatsapp.service");

  router.get("/", authenticate, (req, res) => {
    const userId = req.user.id;
    const conectado = isClientReady(userId);
    res.json({ conectado });
  });

  module.exports = router;
