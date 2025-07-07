const express = require('express');
const authController = require('../../controllers/auth/authController');
const authMiddleware = require('../../middlewares/authMiddleware');
const router = express.Router();
//login
router.post('/login', authController.loginUser);

//register
router.post('/register',  authController.registerUser);

// Ruta opcional para consultar permisos
router.get('/permissions', authMiddleware, authController.getUserPermissions);


module.exports = router;
