// Permisos centralizados para roles de usuario

const permissions = {
  canCreate: {
    superadmin: ['superadmin', 'admin', 'general'],
    admin:      ['general'],
    general:    []
  },
  canList: {
    superadmin: ['superadmin', 'admin', 'general'],
    admin:      ['admin', 'general'],
    general:    []
  },
  canAccess: {
    superadmin: ['superadmin', 'admin', 'general'],
    admin:      ['admin', 'general'],
    general:    []
  },
  canModify: {
    superadmin: ['superadmin', 'admin', 'general'],
    admin:      ['general'],
    general:    []
  }
};

export default permissions; 