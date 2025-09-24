import mongoose from 'mongoose';

const toolSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    entity: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    method: {
        type: String,
        default: 'GET',
        enum: ['GET'],
        uppercase: true,
        select: false
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
        ref: 'User',
        select: false
    }
}, {
    timestamps: { select: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Índices para búsquedas frecuentes
toolSchema.index({ company: 1, name: 1 }, { unique: true });
toolSchema.index({ company: 1, entity: 1 });

// Método estático para buscar tools por compañía
toolSchema.statics.findByCompany = function (companyId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const query = { company: companyId };

    return this.find(query)
        .select('_id name entity description company createdBy')
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'username email')
        .sort({ createdAt: -1 });
};

const Tool = mongoose.model('Tool', toolSchema);

export default Tool;