import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'general'],
    default: 'general',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    required: true
  },
  profileRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
  },
  accessCode: {
    type: String,
    validate: {
      validator: function (value) {
        // Solo requerido si el rol es admin o superadmin
        if (this.role === 'admin' || this.role === 'superadmin') {
          return value && value.trim().length > 0;
        }
        return true; // No se requiere para el rol 'general'
      },
      message: 'El código de acceso es obligatorio para roles admin o superadmin.'
    }
  }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
