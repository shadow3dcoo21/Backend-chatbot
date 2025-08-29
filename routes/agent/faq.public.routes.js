import express from 'express';
import {
    listFAQsPublic,
    updateFAQEmbedding,
} from '../../controllers/agent/faq.controller.js';

const router = express.Router();

// Rutas públicas (sin autenticación)
router.get('/', listFAQsPublic);
router.patch('/:id/embedding', updateFAQEmbedding); // Permite actualizar embedding sin auth

export default router;