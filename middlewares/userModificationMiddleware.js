import permissions from '../../config/permissions.js';
import mongoose from 'mongoose';
import User from '../../models/Users/User.js';
import Person from '../../models/Person/Person.js';

const validateRegistrationPermissions = (req, res, next) => {
    const creatorRole = req.user.role;
    const targetRole  = req.originalUrl.split('/').pop();
  
    const canCreate = permissions.canCreate;
  
    if (!canCreate[creatorRole]) {
      return res.status(403).json({ message: 'Rol de usuario no válido para registros' });
    }
    if (!canCreate[creatorRole].includes(targetRole)) {
      return res.status(403).json({
        message: `Tu rol '${creatorRole}' no puede crear usuarios con rol '${targetRole}'.`
      });
    }
  
    req.targetRole = targetRole;
    next();
  };

// Middleware para validar permisos de modificación - Refactorizado
const validateModificationAccess = async (req, res, next) => {
    try {
      const userRole = req.user.role;
      const userId = req.user.id; // Usar id en lugar de userId
      const targetUserId = req.params.id;
  
      // Verificar si es su propio perfil (siempre permitido para modificar datos básicos)
      if (userId === targetUserId) {
        // req.canModify = true; // Comentado - usar permisos centralizados
        req.isOwnProfile = true;
        req.allowedModify = true;
        return next();
      }
  
      // Obtener permisos de modificación desde configuración centralizada
      const canModifyRoles = permissions.canModify[userRole] || [];
      
      if (canModifyRoles.length === 0) {
        return res.status(403).json({ 
          message: "No tienes permisos para modificar otros usuarios" 
        });
      }
  
      // Verificar rol del usuario objetivo
      const targetUser = await User.findById(targetUserId).select('role status');
      if (!targetUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
  
      // Validar que el usuario objetivo esté activo
      if (targetUser.status !== 'active') {
        return res.status(404).json({ message: "Usuario no encontrado o inactivo" });
      }
  
      // Verificar si el rol del usuario objetivo está permitido para modificación
      if (!canModifyRoles.includes(targetUser.role)) {
        return res.status(403).json({ 
          message: `No tienes permisos para modificar usuarios con rol '${targetUser.role}'` 
        });
      }
  
      // Validación adicional: admin no puede modificar superadmin
      if (userRole === 'admin' && targetUser.role === 'superadmin') {
        return res.status(403).json({ 
          message: "No puedes modificar usuarios con rol superadmin" 
        });
      }
  
      // req.canModify = true; // Comentado - usar permisos centralizados
      req.allowedModify = true;
      req.targetUserRole = targetUser.role;
      req.targetUserStatus = targetUser.status;
      next();
  
    } catch (error) {
      console.error('Error en validación de modificación:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  };

export {
    validateModificationAccess,
    validateRegistrationPermissions
}