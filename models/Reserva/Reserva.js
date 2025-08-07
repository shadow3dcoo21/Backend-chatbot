import mongoose from 'mongoose';

const reservaSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    peopleCount: {
        type: Number,
        required: true,
        min: [1, 'La cantidad de personas debe ser como mínimo 1']
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    dateTime: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['confirmado', 'pendiente', 'cancelado'],
        default: 'pendiente'
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Índices para búsquedas frecuentes
reservaSchema.index({ company: 1, dateTime: -1 });
reservaSchema.index({ status: 1, company: 1 });

const Reserva = mongoose.model('Reserva', reservaSchema);

export default Reserva;
