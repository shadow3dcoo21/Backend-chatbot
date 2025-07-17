import { isChatbotActive, setChatbotActive } from '../../services/configChatbot.service.js';

export async function getConfigChatbot(req, res) {
  try {
    const active = await isChatbotActive();
    res.json({ active });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener configuración', error: err.message });
  }
}

export async function updateConfigChatbot(req, res) {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return res.status(400).json({ message: 'El campo active debe ser booleano' });
    }
    const updated = await setChatbotActive(active);
    res.json({ active: updated });
  } catch (err) {
    res.status(500).json({ message: 'Error al actualizar configuración', error: err.message });
  }
} 