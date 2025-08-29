import express from 'express';
import {
    createFAQ,
    listFAQs,
    getFAQById,
    updateFAQ,
    updateFAQEmbedding,
    deleteFAQ
} from '../../controllers/agent/faq.controller.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import { canHandleFAQs } from '../../middlewares/permissionMiddleware.js';

const router = express.Router();

// Rutas protegidas (requieren autenticación y permisos)
router.use(authMiddleware);
router.use(canHandleFAQs);

// CRUD completo
router.post('/', createFAQ);
router.get('/', listFAQs);
router.get('/:id', getFAQById);
router.put('/:id', updateFAQ);
router.delete('/:id', deleteFAQ);

// PATCH para actualizar solo embedding (también protegido)
router.patch('/:id/embedding', updateFAQEmbedding);

export default router;