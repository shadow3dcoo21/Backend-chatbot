const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/authMiddleware');
const { initializeWhatsappClient } = require('../../services/whatsapp.service');
const { setupWhatsAppSocketBroadcast } = require('../../services/whatsapp.broadcast'); // 👈 Asegúrate de crear este archivo

router.post('/', authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    initializeWhatsappClient(userId);
    setupWhatsAppSocketBroadcast(userId); // 👈 Esta línea activa los sockets y n8n

    res.json({ message: 'Inicializando WhatsApp para usuario', userId });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar cliente de WhatsApp', message: err.message });
  }
});

module.exports = router;
