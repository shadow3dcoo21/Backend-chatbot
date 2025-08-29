import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema({
    questions: {
        type: [String],
        required: true,
        validate: {
            validator: function (v) {
                return v && v.length > 0;
            },
            message: 'Al menos una pregunta es requerida'
        }
    },
    answer: {
        type: String,
        required: true,
        trim: true
    },
    tags: {
        type: [String],
        default: []
    },
    embedding: {
        type: [Number],
        default: undefined
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
        required: true
    }
}, {
    timestamps: true
});

// Índices para optimizar búsquedas
faqSchema.index({ company: 1, createdAt: -1 });
faqSchema.index({ company: 1, tags: 1 });
faqSchema.index({ questions: 'text', answer: 'text' });

// Método para obtener FAQs por tags
faqSchema.statics.findByTags = function (companyId, tags, limit = 10) {
    return this.find({
        company: companyId,
        tags: { $in: tags }
    })
        .sort({ createdAt: -1 })
        .limit(limit);
};

const FAQ = mongoose.model('FAQ', faqSchema);

export default FAQ;