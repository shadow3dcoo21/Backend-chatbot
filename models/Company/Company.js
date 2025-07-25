import mongoose from 'mongoose';

// Roles permitidos para los miembros de la compañía
const MEMBER_ROLES = ['owner', 'admin', 'asesor', 'user'];
const MEMBER_STATUSES = ['active', 'pending', 'revoked'];

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: MEMBER_ROLES,
    required: true,
    default: 'user'
  },
  status: {
    type: String,
    enum: MEMBER_STATUSES,
    required: true,
    default: 'pending'
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Otros campos opcionales como permisos específicos
  customPermissions: {
    type: Map,
    of: Boolean,
    default: {}
  }
}, { _id: false });

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  sector: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  employeeCount: {
    type: Number,
    default: 0
  },
  image: {
    type: String, // URL de la imagen
    default: ''
  },
  members: [memberSchema],
  // Otros campos de la compañía...
  settings: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índice para búsquedas por miembro
companySchema.index({ 'members.userId': 1 });

// Método para verificar si un usuario es miembro con un rol específico
companySchema.methods.hasMember = function(userId, roles = []) {
  const member = this.members.find(m => 
    m.userId.equals(userId) && 
    m.status === 'active' && 
    (roles.length === 0 || roles.includes(m.role))
  );
  return !!member;
};

// Método para obtener el rol de un miembro
companySchema.methods.getMemberRole = function(userId) {
  const member = this.members.find(m => m.userId.equals(userId));
  return member ? member.role : null;
};

// Método estático para buscar compañías de un usuario
companySchema.statics.findByUserId = function(userId, status = 'active') {
  return this.find({ 'members.userId': userId, 'members.status': status });
};

export default mongoose.model('Company', companySchema);