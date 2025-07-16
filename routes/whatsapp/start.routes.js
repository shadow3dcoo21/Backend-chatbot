import express from 'express';
import authenticate from '../../middlewares/authMiddleware.js';
import { initializeWhatsappClient } from '../../services/whatsapp.service.js';
import { setupWhatsAppSocketBroadcast } from '../../services/whatsapp.broadcast.js'; // 👈 Asegúrate de crear este archivo

const router = express.Router();

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



export default router;
