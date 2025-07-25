import express from 'express';
import authenticate from '../../middlewares/authMiddleware.js';
import { getConfigChatbot, updateConfigChatbot } from '../../controllers/messaging/configchatbot.controller.js';

const router = express.Router();

router.get('/', authenticate, getConfigChatbot);
router.put('/', authenticate, updateConfigChatbot);

export default router; 