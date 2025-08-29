import express from 'express';
import {
    createTool,
    listTools,
    getToolById,
    updateTool,
    deleteTool,
    listToolsPublic
} from '../../controllers/agent/tool.controller.js';
import authMiddleware from '../../middlewares/authMiddleware.js';
import { canHandleTools } from '../../middlewares/permissionMiddleware.js';

const router = express.Router();
router.get('/public', listToolsPublic); // Listar tools públicos

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Aplicar middleware de permisos para tools
router.use(canHandleTools);

// Rutas CRUD para tools
router.post('/', createTool);
router.get('/', listTools);
router.get('/:id', getToolById);
router.put('/:id', updateTool);
router.delete('/:id', deleteTool);

export default router;