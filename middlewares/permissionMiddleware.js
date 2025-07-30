import Company from '../models/Company/Company.js';

/**
 * Middleware para verificar permisos basados en roles de compañía
 * @param {string[]} allowedRoles - Roles permitidos para acceder al recurso
 * @param {Object} [options] - Opciones adicionales
 * @param {boolean} [options.allowSelf=false] - Permitir acceso si el usuario es el dueño del recurso
 * @returns {Function} Middleware de Express
 */
const checkCompanyPermission = (allowedRoles = [], options = {}) => {
  const { allowSelf = false } = options;

  return async (req, res, next) => {
    try {
      const { id: userId } = req.user;
      const companyId = req.params.companyId || req.params.id;

      if (!companyId) {
        return res.status(400).json({
          error: 'Se requiere el ID de la compañía'
        });
      }

      // Buscar la compañía con los miembros relevantes
      const company = await Company.findOne({
        _id: companyId,
        'members.userId': userId,
        'members.status': 'active'
      });

      if (!company) {
        return res.status(404).json({
          error: 'Compañía no encontrada o no tienes acceso'
        });
      }

      // Encontrar el miembro actual
      const member = company.members.find(m =>
        m.userId.toString() === userId.toString()
      );

      if (!member) {
        return res.status(403).json({
          error: 'No tienes permisos para realizar esta acción'
        });
      }

      // Verificar si el usuario tiene un rol permitido
      const hasRequiredRole = allowedRoles.length === 0 ||
        allowedRoles.includes(member.role);

      // Opcional: permitir acceso si el usuario es el dueño del recurso
      const isOwner = member.role === 'owner';
      const isSelf = allowSelf && req.params.userId === userId;

      if (!hasRequiredRole && !isOwner && !isSelf) {
        return res.status(403).json({
          error: 'No tienes los permisos necesarios para esta acción'
        });
      }

      // Adjuntar información de la compañía y el rol al request
      req.company = company;
      req.memberRole = member.role;
      req.isCompanyOwner = isOwner;

      next();
    } catch (error) {
      console.error('Error en verificación de permisos:', error);
      return res.status(500).json({
        error: 'Error al verificar permisos'
      });
    }
  };
};

/**
 * Middleware para verificar si el usuario es propietario de la compañía
 */
const isCompanyOwner = checkCompanyPermission(['owner']);

/**
 * Middleware para verificar si el usuario es administrador o propietario
 */
const isCompanyAdmin = checkCompanyPermission(['owner', 'admin']);

/**
 * Middleware para verificar si el usuario es miembro activo
 */
const isCompanyMember = checkCompanyPermission(['owner', 'admin', 'asesor', 'user']);

/**
 * Middleware para verificar permisos de gestión de productos
 * Permite acceso a admins y miembros con permiso canHandleProducts
 */
const canHandleProducts = async (req, res, next) => {
  try {
    const { id } = req.user;
    const companyId = req.body.companyId || req.query.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el ID de la compañía',
        code: 'COMPANY_ID_REQUIRED'
      });
    }

    // Buscar la compañía con los miembros relevantes
    const company = await Company.findOne({
      _id: companyId,
      'members.userId': id,
      'members.status': 'active'
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Compañía no encontrada o no tienes acceso',
        code: 'COMPANY_NOT_FOUND'
      });
    }

    // Encontrar el miembro actual
    const member = company.members.find(m =>
      m.userId.toString() === id.toString()
    );

    if (!member) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para gestionar productos',
        code: 'PRODUCT_MANAGEMENT_FORBIDDEN'
      });
    }

    // Verificar si es admin o tiene permiso canHandleProducts
    const isAdmin = ['owner', 'admin'].includes(member.role);
    const hasProductPermission = member.permissions?.canHandleProducts === true;

    if (!isAdmin && !hasProductPermission) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para gestionar productos',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Agregar información de la compañía al request para su uso posterior
    req.company = company;
    req.member = member;
    next();
  } catch (error) {
    console.error('Error en verificación de permisos de productos:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al verificar permisos',
      code: 'PERMISSION_CHECK_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export {
  checkCompanyPermission,
  isCompanyOwner,
  isCompanyAdmin,
  isCompanyMember,
  canHandleProducts
};
