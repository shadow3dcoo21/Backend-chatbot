import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  direction: {
    type: String,
    enum: ['incoming', 'outgoing'],
    required: true
  },
  isAutomated: {
    type: Boolean,
    default: false
  },
  messageId: {
    type: String
  }
}, { _id: true });

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
  },
  messages: [messageSchema]
}, { timestamps: true });

contactSchema.index({ companyRef: 1, number: 1 }, { unique: true });

contactSchema.statics.findByCompanyAndNumber = async function(companyId, number) {
  return this.findOne({ companyRef: companyId, number });
};

contactSchema.statics.addMessage = async function(companyId, number, messageData) {
  const contact = await this.findOne({ companyRef: companyId, number });
  
  if (!contact) {
    // Si el contacto no existe, crearlo
    const newContact = new this({
      companyRef: companyId,
      number: number,
      name: messageData.nombre || null,
      messages: [messageData]
    });
    return await newContact.save();
  } else {
    // Si el contacto existe, agregar el mensaje
    contact.messages.push(messageData);
    
    // Actualizar el nombre si se proporciona y es diferente al actual
    if (messageData.nombre && messageData.nombre !== contact.name) {
      const oldName = contact.name;
      contact.name = messageData.nombre;
      console.log(`📝 Actualizando nombre del contacto ${number} de "${oldName}" a "${messageData.nombre}"`);
    }
    
    return await contact.save();
  }
};

contactSchema.statics.getMessages = async function(companyId, number, limit = 50) {
  const contact = await this.findOne({ companyRef: companyId, number })
    .select('messages')
    .lean();
  
  if (!contact) {
    return [];
  }
  
  // Ordenar mensajes por timestamp descendente y limitar
  return contact.messages
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
};

contactSchema.statics.getConversationHistory = async function(companyId, number, limit = 20) {
  const contact = await this.findOne({ companyRef: companyId, number })
    .select('messages name number')
    .lean();
  
  if (!contact) {
    return {
      contact: { name: null, number },
      messages: []
    };
  }
  
  // Ordenar mensajes por timestamp ascendente (más antiguos primero) para contexto cronológico
  const messages = contact.messages
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-limit); // Tomar los últimos N mensajes
  
  return {
    contact: {
      name: contact.name,
      number: contact.number
    },
    messages: messages
  };
};

export default mongoose.model('Contact', contactSchema); 