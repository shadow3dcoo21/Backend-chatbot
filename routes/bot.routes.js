// routes/bot.routes.js
import express from 'express';
import { 
  setChatBotState, 
  toggleChatBotState, 
  getChatBotState,
  getAllChatStates
} from '../controllers/bot.controller.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener todos los chats del usuario con sus estados
router.get('/chats', getAllChatStates);

// Obtener el estado del bot para un chat específico
router.get('/:chatId/state', getChatBotState);

// Cambiar el estado del bot para un chat específico
router.post('/state', setChatBotState);

// Alternar el estado del bot para un chat específico
router.post('/:chatId/toggle', toggleChatBotState);

export default router;
