// Script para limpiar sesiones de WhatsApp Web
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionsPath = path.join(__dirname, '.wwebjs_auth');

console.log('🧹 Iniciando limpieza de sesiones WhatsApp...');

if (fs.existsSync(sessionsPath)) {
  try {
    fs.rmSync(sessionsPath, { recursive: true, force: true });
    console.log('✅ Sesiones eliminadas correctamente');
  } catch (error) {
    console.error('❌ Error eliminando sesiones:', error);
  }
} else {
  console.log('ℹ️ No hay sesiones para eliminar');
}

console.log('🎯 Limpieza completada. Reinicia el servidor para aplicar cambios.'); 