import mongoose from 'mongoose';

const ConfigChatbotSchema = new mongoose.Schema({
  active: { type: Boolean, default: true }
});

export default mongoose.model('ConfigChatbot', ConfigChatbotSchema); 