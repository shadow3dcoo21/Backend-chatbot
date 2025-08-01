import express from 'express';
import authenticate from '../../middlewares/authMiddleware.js';
import { getConfigChatbot, updateConfigChatbot } from '../../controllers/messaging/configchatbot.controller.js';

const router = express.Router();

router.get('/:companyId', authenticate, getConfigChatbot);
router.put('/:companyId', authenticate, updateConfigChatbot);

export default router; 