import mongoose from 'mongoose';

// Esquema para el rango de días
const dayRangeSchema = new mongoose.Schema({
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    }
}, { _id: false });

// Esquema para el rango de horas
const hourRangeSchema = new mongoose.Schema({
    startHour: {
        type: Number,
        required: true,
        min: 0,
        max: 23
    },
    endHour: {
        type: Number,
        required: true,
        min: 0,
        max: 23
    }
}, { _id: false });

// Esquema principal de Promociones
const promoSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    img: {
        type: String, // URL de la imagen
        trim: true
    },
    periodo: {
        type: dayRangeSchema,
        required: true
    },
    periodo_hour: {
        type: hourRangeSchema,
        required: true
    },
    active: {
        type: Boolean,
        default: true
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Índices para búsquedas frecuentes
promoSchema.index({ name: 'text', description: 'text' });
promoSchema.index({ company: 1, name: 1 }, { unique: true });
promoSchema.index({ active: 1, company: 1 });
promoSchema.index({ 'periodo.startDate': 1, 'periodo.endDate': 1 });

// Método para verificar si la promoción está vigente
promoSchema.methods.isActive = function () {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Verificar si está dentro del rango de días
    const isWithinDateRange = now >= this.periodo.startDate && now <= this.periodo.endDate;
    
    // Verificar si está dentro del rango de horas
    const isWithinHourRange = currentHour >= this.periodo_hour.startHour && currentHour <= this.periodo_hour.endHour;
    
    return this.active && isWithinDateRange && isWithinHourRange;
};

// Método estático para buscar promociones activas por compañía
promoSchema.statics.findActiveByCompany = function (companyId, options = {}) {
    const { page = 1, limit = 10, search = '' } = options;
    const skip = (page - 1) * limit;
    const now = new Date();

    const query = { 
        company: companyId,
        active: true,
        'periodo.startDate': { $lte: now },
        'periodo.endDate': { $gte: now }
    };

    if (search) {
        query.$text = { $search: search };
    }

    return this.find(query)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'username email')
        .populate('updatedBy', 'username email')
        .sort({ createdAt: -1 });
};

// Método estático para buscar promociones vigentes (incluyendo validación de horas)
promoSchema.statics.findVigentPromos = function (companyId) {
    const now = new Date();
    const currentHour = now.getHours();

    return this.find({
        company: companyId,
        active: true,
        'periodo.startDate': { $lte: now },
        'periodo.endDate': { $gte: now },
        'periodo_hour.startHour': { $lte: currentHour },
        'periodo_hour.endHour': { $gte: currentHour }
    })
    .populate('createdBy', 'username email')
    .populate('updatedBy', 'username email')
    .sort({ createdAt: -1 });
};

const Promo = mongoose.model('Promo', promoSchema);

export default Promo;
