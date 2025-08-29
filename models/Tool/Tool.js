import mongoose from 'mongoose';

const toolSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    method: {
        type: String,
        required: true,
        enum: ['GET', 'POST'],
        uppercase: true
    },
    url: {
        type: String,
        required: true,
        trim: true
    },
    queryTemplate: {
        type: String,
        trim: true
    },
    bodyTemplate: {
        type: String,
        trim: true
    },
    headers: {
        type: Map,
        of: String,
        default: new Map()
    },
    pick: {
        type: String,
        trim: true
    },
    enabled: {
        type: Boolean,
        default: true
    },
    description: {
        type: String,
        trim: true
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
toolSchema.index({ company: 1, name: 1 }, { unique: true });
toolSchema.index({ enabled: 1, company: 1 });

// Método estático para buscar tools por compañía
toolSchema.statics.findByCompany = function (companyId, options = {}) {
    const { page = 1, limit = 10, enabled } = options;
    const skip = (page - 1) * limit;

    const query = { company: companyId };

    if (enabled !== undefined) {
        query.enabled = enabled;
    }

    return this.find(query)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'username email')
        .populate('updatedBy', 'username email')
        .sort({ createdAt: -1 });
};

const Tool = mongoose.model('Tool', toolSchema);

export default Tool;