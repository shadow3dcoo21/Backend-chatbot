import express from 'express';
import * as authController from '../../controllers/auth/auth.controller.js';
import * as middleware from '../../middlewares/userModificationMiddleware.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
const router = express.Router();
//login
router.post('/login', authController.loginUser);

//register
router.post('/register',  authMiddleware, middleware.validateRegistrationPermissions,authController.registerUser);

// Ruta opcional para consultar permisos
router.get('/permissions', authMiddleware, authController.getUserPermissions);


export default router;
