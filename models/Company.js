import mongoose from 'mongoose';

const CompanySchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  tipo: {
    type: String,
    required: true,
    trim: true
  },
  fundado: {
    type: String,
    trim: true
  },
  direccion: {
    type: String,
    trim: true
  },
  telefonoRecepcion: {
    type: String,
    trim: true
  },
  telefonoSecretaria: {
    type: String,
    trim: true
  },
  correoInstitucional: {
    type: String,
    trim: true,
    lowercase: true
  },
  // Horario de atención como array de objetos para mayor flexibilidad
  horarioAtencion: [{
    concepto: {
      type: String,
      trim: true
    },
    descripcion: {
      type: String,
      trim: true
    }
  }],
  lemaSaludo: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  // Campos personalizables adicionales como array de objetos
  camposAdicionales: [{
    concepto: {
      type: String,
      trim: true,
      required: true
    },
    descripcion: {
      type: String,
      trim: true
    },
    tipo: {
      type: String,
      enum: ['texto', 'numero', 'fecha', 'booleano', 'url'],
      default: 'texto'
    },
    valor: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  // Información de contacto adicional
  contactos: [{
    tipo: {
      type: String,
      trim: true,
      required: true
    },
    valor: {
      type: String,
      trim: true
    },
    descripcion: {
      type: String,
      trim: true
    }
  }],
  // Servicios o características de la empresa
  servicios: [{
    nombre: {
      type: String,
      trim: true
    },
    descripcion: {
      type: String,
      trim: true
    },
    disponible: {
      type: Boolean,
      default: true
    }
  }],
  activo: {
    type: Boolean,
    default: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento de búsquedas
CompanySchema.index({ nombre: 'text', tipo: 'text' });
CompanySchema.index({ activo: 1 });
CompanySchema.index({ 'camposAdicionales.concepto': 1 });

export default mongoose.model('Company', CompanySchema);
