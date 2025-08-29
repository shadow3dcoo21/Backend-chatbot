/**
 * Rutas específicas para N8N
 * Estas rutas están optimizadas para ser consumidas por N8N
 * y no requieren el mismo nivel de autenticación que las rutas normales
 */

import express from 'express';
import n8nAuthMiddleware from '../../middlewares/agentAuthMiddleware.js';
import * as n8nController from '../../controllers/agent/agent.controller.js';

const router = express.Router();

// Aplicar middleware de autenticación para N8N a todas las rutas
//router.use(n8nAuthMiddleware);

// Rutas para obtener información de productos
router.get('/company/:companyId/products', n8nController.getCompanyProducts);

// Rutas para obtener promociones activas
router.get('/company/:companyId/promos/active', n8nController.getActivePromos);

// Ruta para obtener información básica de la compañía
router.get('/company/:companyId/info', n8nController.getCompanyInfo);

// Ruta para obtener reservas de una compañía
router.get('/company/:companyId/reservations', n8nController.getCompanyReservations);

export default router;