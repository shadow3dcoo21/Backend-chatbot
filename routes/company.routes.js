import express from 'express';
import {
    createCompany,
    getCompany,
    updateCompany,
    deleteCompany,
    listMyCompanies
} from '../controllers/company/company.controller.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { isCompanyOwner, isCompanyAdmin, isCompanyMember } from '../middlewares/permissionMiddleware.js';
import { uploadCompanyImage, handleUploadError } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);



// Rutas de compañía
router.post('/', uploadCompanyImage, handleUploadError, createCompany); // Cualquier usuario autenticado puede crear una compañía
router.get('/my-companies', listMyCompanies); // Listar compañías del usuario actual

// Rutas protegidas que requieren pertenecer a la compañía
router.get('/:id', isCompanyMember, getCompany); // Ver detalles de la compañía (miembros activos)
router.put('/:id', isCompanyAdmin, uploadCompanyImage, handleUploadError, updateCompany); // Solo admin/owner pueden actualizar
router.delete('/:id', isCompanyOwner, deleteCompany); // Solo el dueño puede eliminar

export default router;