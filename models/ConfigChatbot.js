import mongoose from 'mongoose';

const ConfigChatbotSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  active: { type: Boolean, default: true }
});

export default mongoose.model('ConfigChatbot', ConfigChatbotSchema); 