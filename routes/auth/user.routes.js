import express from 'express';
import * as userController from '../../controllers/auth/user.controller.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import { validateUserAccess, validatePersonAccess, validateListAccess } from '../../middlewares/userAccessMiddleware.js';
import { validateModificationAccess } from '../../middlewares/userModificationMiddleware.js';

const router = express.Router();

// Listar usuarios (GET /api/users)
router.get('/', authMiddleware, validateListAccess, userController.getUsers);

// Obtener usuario por ID (GET /api/users/:id)
router.get('/:id', authMiddleware, validateUserAccess, userController.getUserById);

// Actualizar usuario (PUT /api/users/:id)
router.put('/:id', authMiddleware, validateModificationAccess, userController.updateUser);

// Eliminar usuario (DELETE /api/users/:id)
router.delete('/:id', authMiddleware, validateModificationAccess, userController.deleteUser);

// Cambiar estado de usuario (PATCH /api/users/:id/status)
router.patch('/:id/status', authMiddleware, validateModificationAccess, userController.changeStatus);

// Obtener perfil propio (GET /api/users/me)
router.get('/me/profile', authMiddleware, userController.getMyProfile);

// Obtener usuario por ID de Person (GET /api/users/person/:id)
router.get('/person/:id', authMiddleware, validatePersonAccess, userController.getUserByPersonId);

export default router;