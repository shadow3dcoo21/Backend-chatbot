import express from 'express';
import multer from 'multer';
import { 
  getAllCompanies,
  getCompanyById,
  createCompany,
  uploadCompaniesFromCSV,
  updateCompany,
  deleteCompany,
  bulkDeleteCompanies,
  addCustomField,
  updateCustomField
} from '../controllers/company.controller.js';

const router = express.Router();

// Configuración de multer para archivos CSV
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/temp/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'companies-' + uniqueSuffix + '.csv');
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
});

// 🔐 Usar autenticación simple


// ========================
// 1. Obtener empresas
// ========================

// Obtener todas las empresas con paginación y filtros
router.get('/', getAllCompanies);

// Obtener una empresa específica por ID
router.get('/:id', getCompanyById);

// ========================
// 2. Crear empresas
// ========================

// Crear una nueva empresa
router.post('/', createCompany);

// Subir múltiples empresas desde archivo CSV
router.post('/upload-csv', upload.single('csv'), uploadCompaniesFromCSV);

// ========================
// 3. Actualizar empresas
// ========================

// Actualizar una empresa existente
router.put('/:id', updateCompany);

// ========================
// 4. Eliminar empresas
// ========================

// Eliminar una empresa específica
router.delete('/:id', deleteCompany);

// Eliminar múltiples empresas en lote
router.delete('/bulk-delete', bulkDeleteCompanies);

// ========================
// 5. Campos personalizables
// ========================

// Agregar un nuevo campo personalizable
router.post('/:id/campos', addCustomField);

// Actualizar un campo personalizable existente
router.put('/:id/campos/:concepto', updateCustomField);

export default router;
