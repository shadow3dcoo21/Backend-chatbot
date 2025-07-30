import express from 'express';
import { canHandleProducts } from '../middlewares/permissionMiddleware.js';
import * as productController from '../controllers/product/product.controller.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authMiddleware, canHandleProducts);

// Rutas de productos
router.post('/', productController.createProduct);
router.get('/', productController.listCompanyProducts);
router.get('/:id', productController.getProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

export default router;
