/**
 * Rutas para la integración con Google Calendar API
 */

import express from 'express';
import googleController from '../../controllers/google/google.controller.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import { checkCompanyPermission } from '../../middlewares/permissionMiddleware.js';


const router = express.Router();

/**
 * @route GET /api/google/auth/:companyId
 * @desc Obtiene la URL de autenticación para Google OAuth
 * @access Private (requiere autenticación)
 */
router.get('/auth/:companyId', authMiddleware, googleController.getAuthUrl);

/**
 * @route GET /api/google/callback
 * @desc Maneja el callback de Google OAuth
 * @access Public (callback de Google)
 */
router.get('/callback', googleController.handleCallback);

/**
 * @route GET /api/google/status/:companyId
 * @desc Verifica el estado de la conexión con Google Calendar
 * @access Private (requiere autenticación)
 */
router.get('/status/:companyId', authMiddleware, googleController.getConnectionStatus);

/**
 * @route DELETE /api/google/disconnect/:companyId
 * @desc Desconecta la integración con Google Calendar
 * @access Private (requiere autenticación)
 */
router.delete('/disconnect/:companyId', authMiddleware, googleController.disconnect);

// Crear reserva con Google Calendar
router.post('/reservation/:companyId', googleController.createReservationWithCalendar);

export default router;