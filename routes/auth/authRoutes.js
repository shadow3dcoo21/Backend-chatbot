import express from 'express';
import * as authController from '../../controllers/auth/authController.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
const router = express.Router();
//login
router.post('/login', authController.loginUser);

//register
router.post('/register',  authController.registerUser);

// Ruta opcional para consultar permisos
router.get('/permissions', authMiddleware, authController.getUserPermissions);


export default router;
