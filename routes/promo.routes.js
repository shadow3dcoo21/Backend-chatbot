import express from 'express';
import { canHandlePromos } from '../middlewares/permissionMiddleware.js';
import * as promoController from '../controllers/promo/promo.controller.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { uploadCompanyImage, handleUploadError } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authMiddleware, canHandlePromos);

// Rutas de promociones
router.post('/', uploadCompanyImage, handleUploadError, promoController.createPromo);
router.get('/', promoController.listCompanyPromos);
router.get('/vigent', promoController.listVigentPromos);
router.get('/:id', promoController.getPromo);
router.put('/:id', uploadCompanyImage, handleUploadError, promoController.updatePromo);
router.delete('/:id', promoController.deletePromo);

export default router; 