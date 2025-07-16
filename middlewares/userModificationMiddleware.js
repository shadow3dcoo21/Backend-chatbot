import permissions from '../config/permissions.js';
import User from '../models/Users/User.js';

const validateRegistrationPermissions = (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return res.status(401).json({
        message: 'Token de autenticación requerido'
      });
    }

    // Extraer roles
    const creatorRole = req.user.role;
    const targetRole = req.body.role;

    // Validar que se haya enviado el rol objetivo
    if (!targetRole) {
      return res.status(400).json({
        message: 'Se requiere el rol del nuevo usuario (role) en el cuerpo de la solicitud'
      });
    }

    const canCreate = permissions.canCreate;

    
    if (!canCreate[creatorRole]) {
      return res.status(403).json({
        message: `Tu rol '${creatorRole}' no tiene permisos para crear usuarios`
      });
    }

   
    if (!canCreate[creatorRole].includes(targetRole)) {
      return res.status(403).json({
        message: `Tu rol '${creatorRole}' no puede crear usuarios con rol '${targetRole}'.`
      });
    }

    // Validación de empresa para admin
    if (creatorRole === 'admin') {
      if (!req.body.companyId || !req.user.company || req.body.companyId !== String(req.user.company.id)) {
        return res.status(403).json({
          message: 'Solo puedes crear usuarios para tu propia empresa.'
        });
      }
    }

    
    req.targetRole = targetRole;
    next();

  } catch (error) {
    console.error('Error en validación de permisos:', error);
    return res.status(500).json({
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};


// Middleware para validar permisos de modificación - Refactorizado
const validateModificationAccess = async (req, res, next) => {
    try {
      console.log("objeto user", req.user)
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
      const targetUser = await User.findById(targetUserId).select('role status companyRef');
      if (!targetUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
  
      // Validar que el usuario objetivo esté activo
      if (targetUser.status !== 'active') {
        return res.status(404).json({ message: "Usuario no encontrado o inactivo" });
      }
  
      // Validación de empresa para admin
      if (userRole === 'admin') {
        if (!req.user.company || !targetUser.companyRef || String(targetUser.companyRef) !== String(req.user.company.id)) {
          return res.status(403).json({
            message: 'Solo puedes modificar usuarios de tu propia empresa.'
          });
        }
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