import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  companyRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    trim: true
  },
  number: {
    type: String,
    required: true
  },
  excludedFromN8n: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

contactSchema.index({ companyRef: 1, number: 1 }, { unique: true });

contactSchema.statics.findByCompanyAndNumber = async function(companyId, number) {
  return this.findOne({ companyRef: companyId, number });
};

export default mongoose.model('Contact', contactSchema); 