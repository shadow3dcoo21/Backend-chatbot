import fs from 'fs';
import path from 'path';

/**
 * Obtiene la URL pública de una imagen local
 * @param {string} filename - Nombre del archivo
 * @returns {string} URL pública de la imagen
 */
export const getImageUrl = (filename) => {
  if (!filename) return '';
  return `/uploads/companies/${filename}`;
};

/**
 * Elimina una imagen local
 * @param {string} filename - Nombre del archivo a eliminar
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
export const deleteLocalImage = async (filename) => {
  try {
    if (!filename) return true;
    
    const filePath = path.join('uploads', 'companies', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Archivo eliminado: ${filePath}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error al eliminar imagen local:', error);
    return false;
  }
};

/**
 * Valida si una URL es una imagen local válida
 * @param {string} url - URL a validar
 * @returns {boolean} true si es una URL de imagen local válida
 */
export const isValidLocalImageUrl = (url) => {
  if (!url) return false;
  
  // Verificar que sea una URL local de imágenes
  return url.startsWith('/uploads/companies/');
};

/**
 * Extrae el nombre del archivo de una URL local
 * @param {string} url - URL de la imagen
 * @returns {string} Nombre del archivo
 */
export const extractFilenameFromUrl = (url) => {
  if (!url) return '';
  
  const parts = url.split('/');
  return parts[parts.length - 1];
};

/**
 * Verifica si un archivo existe localmente
 * @param {string} filename - Nombre del archivo
 * @returns {boolean} true si el archivo existe
 */
export const fileExists = (filename) => {
  if (!filename) return false;
  
  const filePath = path.join('uploads', 'companies', filename);
  return fs.existsSync(filePath);
}; 