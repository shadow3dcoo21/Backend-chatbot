import mongoose from 'mongoose';

const ConfigChatbotSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
  active: { type: Boolean, default: true }
});

export default mongoose.model('ConfigChatbot', ConfigChatbotSchema); 