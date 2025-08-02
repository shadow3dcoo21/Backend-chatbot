import express from 'express';
import authenticate from '../../middlewares/authMiddleware.js';
import { initializeWhatsappClient } from '../../services/whatsapp.service.js';
import { setupWhatsAppSocketBroadcast } from '../../services/whatsapp.broadcast.js';
import Company from '../../models/Company/Company.js';


const router = express.Router();

router.post('/:companyId', authenticate, async (req, res) => {
  const userId = req.user.id;
  const companyId = req.params.companyId
  if (!companyId) {
    return res.status(400).json({
      error: 'Es necesario especificar la compañia',
      code: 'COMPANY_REQUIRED'
    });
  }
  // Buscar la compañía con los miembros relevantes
  const company = await Company.findOne({
    _id: companyId,
    'members.userId': userId,
    'members.status': 'active'
  });

  if (!company) {
    return res.status(404).json({
      success: false,
      error: 'Compañía no encontrada o no tienes acceso',
      code: 'COMPANY_NOT_FOUND'
    });
  }
  try {
    initializeWhatsappClient(companyId);
    setupWhatsAppSocketBroadcast(companyId); // 👈 Esta línea activa los sockets y n8n

    res.json({ message: 'Inicializando WhatsApp para usuario', userId });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar cliente de WhatsApp', message: err.message });
  }
});



export default router;
