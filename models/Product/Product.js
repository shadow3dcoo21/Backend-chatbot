import mongoose from 'mongoose';

// Esquema para los subproductos (variantes)
const subProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: true });

// Esquema principal del producto
const productSchema = new mongoose.Schema({
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
    image: {
        type: String, // URL de la imagen
        trim: true
    },
    stock: {
        type: Boolean,
        default: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    subProducts: [subProductSchema],
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
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ company: 1, name: 1 }, { unique: true });

// Método para verificar disponibilidad
productSchema.methods.isAvailable = function () {
    return this.stock === true;
};

// Método estático para buscar productos por compañía
productSchema.statics.findByCompany = function (companyId, options = {}) {
    const { page = 1, limit = 10, search = '' } = options;
    const skip = (page - 1) * limit;

    const query = { company: companyId };

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

const Product = mongoose.model('Product', productSchema);

export default Product;
