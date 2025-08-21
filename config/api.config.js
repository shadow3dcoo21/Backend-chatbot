import dotenv from 'dotenv';
dotenv.config();

export const apiConfig = {
  // Puerto del servidor
  port: process.env.PORT || 3000,
  
  // Token de acceso
  apiToken: process.env.API_TOKEN || '1234567890',
  
  // Configuración de CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Configuración de base de datos
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/backend-chatbot',
  
  // Configuración de archivos
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedFileTypes: ['text/csv', 'application/csv'],
  
  // Configuración de paginación
  defaultPageSize: 10,
  maxPageSize: 100
};

export default apiConfig;
