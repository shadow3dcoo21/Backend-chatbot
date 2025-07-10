import permissions from '../../config/permissions.js';
import mongoose from 'mongoose';
import User from '../../models/Users/User.js';

// Middleware para validar acceso a listado de usuarios
const validateListAccess = (req, res, next) => {
    try {
      const userRole = req.user.role;
      const canList = permissions.canList;
  
      if (!canList[userRole] || canList[userRole].length === 0) {
        return res.status(403).json({ 
          message: 'No tienes permisos para listar usuarios' 
        });
      }
  
      req.canListRoles = canList[userRole];
      req.includeOwnProfile = true;
      next();
  
    } catch (error) {
      console.error('Error en validación de listado:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  };
  
  // Middleware para validar acceso a usuario específico - Refactorizado
  const validateUserAccess = async (req, res, next) => {
    try {
      const userRole = req.user.role;
      const userId = req.user.id; // Usar id en lugar de userId
      const targetUserId = req.params.id;
  
      // Validar ObjectId
      if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ message: "ID de usuario inválido" });
      }
  
      // Verificar si es su propio perfil (siempre permitido)
      if (userId === targetUserId) {
        // req.canAccess = true; // Comentado - usar permisos centralizados
        req.isOwnProfile = true;
        req.allowedAccess = true;
        return next();
      }
  
      // Obtener permisos de acceso desde configuración centralizada
      const canAccessRoles = permissions.canAccess[userRole] || [];
      
      if (canAccessRoles.length === 0) {
        return res.status(403).json({ 
          message: "No tienes permisos para acceder a otros usuarios" 
        });
      }
  
      // Verificar el rol del usuario objetivo
      const targetUser = await User.findById(targetUserId).select('role status');
      if (!targetUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
  
      // Validar que el usuario objetivo esté activo
      if (targetUser.status !== 'active') {
        return res.status(404).json({ message: "Usuario no encontrado o inactivo" });
      }
  
      // Verificar si el rol del usuario objetivo está permitido
      if (!canAccessRoles.includes(targetUser.role)) {
        return res.status(403).json({ 
          message: `No tienes permisos para acceder a usuarios con rol '${targetUser.role}'` 
        });
      }
  
      // req.canAccess = true; // Comentado - usar permisos centralizados
      req.allowedAccess = true;
      req.targetUserRole = targetUser.role;
      req.targetUserStatus = targetUser.status;
      next();
  
    } catch (error) {
      console.error('Error en validación de acceso:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  };

export {
    validateUserAccess,
    validateListAccess
}