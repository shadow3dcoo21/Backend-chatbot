import express from 'express';
import { canHandleReservas } from '../middlewares/permissionMiddleware.js';
import * as reservationController from '../controllers/reservation/reservation.controller.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authMiddleware, canHandleReservas);

// Rutas de reservas
router.post('/', reservationController.createReservation);
router.get('/', reservationController.listCompanyReservations);
router.get('/count', reservationController.getReservationsCountByStatus);
router.get('/:id', reservationController.getReservation);
router.put('/:id', reservationController.updateReservation);
router.delete('/:id', reservationController.deleteReservation);

export default router;
