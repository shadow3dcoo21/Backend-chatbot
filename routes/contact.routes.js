import express from 'express';
import { createContact, listContacts, updateContact, deleteContact, isNumberInContacts } from '../controllers/contact.controller.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { validateListAccess } from '../middlewares/userAccessMiddleware.js';

const router = express.Router();

// Crear contacto
router.post('/', authMiddleware, createContact);
// Listar contactos por empresa
router.get('/', authMiddleware, validateListAccess, listContacts);
// Actualizar contacto
router.patch('/:id', authMiddleware, updateContact);
// Eliminar contacto
router.delete('/:id', authMiddleware, deleteContact);
// Comprobar si un número está en la lista de contactos de la empresa
router.get('/exists', authMiddleware, isNumberInContacts);

export default router; 