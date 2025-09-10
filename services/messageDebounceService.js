// Servicio para agrupar mensajes consecutivos y enviarlos después de un delay
import Contact from '../models/Contact/Contact.js';

class MessageDebounceService {
  constructor() {
    this.pendingMessages = new Map(); // companyId -> { chatId: { messages: [], timer: null } }
  }

  /**
   * Agrega un mensaje al buffer de debounce
   * @param {string} companyId - ID de la compañía
   * @param {string} chatId - ID del chat (número con @c.us)
   * @param {Object} messageData - Datos del mensaje
   * @param {Function} sendCallback - Función a ejecutar cuando se envíe el mensaje agrupado
   */
  addMessage(companyId, chatId, messageData, sendCallback) {
    const key = `${companyId}_${chatId}`;
    
    if (!this.pendingMessages.has(companyId)) {
      this.pendingMessages.set(companyId, new Map());
    }
    
    const companyMessages = this.pendingMessages.get(companyId);
    
    if (!companyMessages.has(chatId)) {
      companyMessages.set(chatId, {
        messages: [],
        timer: null,
        contactInfo: {
          name: messageData.nombre || "Desconocido",
          number: chatId.replace('@c.us', '')
        }
      });
    }
    
    const chatData = companyMessages.get(chatId);
    
    // Agregar el mensaje al buffer
    chatData.messages.push({
      content: messageData.mensaje,
      timestamp: new Date(),
      messageId: messageData.messageId
    });
    
    // Limpiar el timer anterior si existe
    if (chatData.timer) {
      clearTimeout(chatData.timer);
    }
    
    // Crear nuevo timer de 5 segundos
    chatData.timer = setTimeout(async () => {
      await this.sendGroupedMessage(companyId, chatId, sendCallback);
    }, 5000);
    
    console.log(`📝 Mensaje agregado al buffer para ${chatId}. Total: ${chatData.messages.length} mensajes`);
  }

  /**
   * Envía el mensaje agrupado y limpia el buffer
   */
  async sendGroupedMessage(companyId, chatId, sendCallback) {
    const companyMessages = this.pendingMessages.get(companyId);
    if (!companyMessages || !companyMessages.has(chatId)) {
      return;
    }
    
    const chatData = companyMessages.get(chatId);
    const messages = chatData.messages;
    
    if (messages.length === 0) {
      return;
    }
    
    // Combinar todos los mensajes en uno solo
    const combinedMessage = this.combineMessages(messages);
    
    // Crear el payload agrupado
    const groupedPayload = {
      numero: chatId,
      nombre: chatData.contactInfo.name,
      mensaje: combinedMessage,
      hora: new Date().toISOString(),
      companyId: companyId,
      isGrouped: true,
      originalMessages: messages.length,
      messageIds: messages.map(m => m.messageId)
    };
    
    console.log(`📤 Enviando mensaje agrupado para ${chatId}: "${combinedMessage}" (${messages.length} mensajes originales)`);
    
    // Ejecutar el callback para enviar a N8N
    try {
      await sendCallback(groupedPayload);
    } catch (error) {
      console.error('❌ Error al enviar mensaje agrupado:', error);
    }
    
    // Limpiar el buffer
    companyMessages.delete(chatId);
    if (companyMessages.size === 0) {
      this.pendingMessages.delete(companyId);
    }
  }

  /**
   * Combina múltiples mensajes en un solo texto
   */
  combineMessages(messages) {
    if (messages.length === 1) {
      return messages[0].content;
    }
    
    // Ordenar por timestamp
    const sortedMessages = messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Combinar con saltos de línea
    return sortedMessages.map(msg => msg.content).join('\n');
  }

  /**
   * Fuerza el envío inmediato de todos los mensajes pendientes para una compañía
   */
  async flushAllMessages(companyId) {
    const companyMessages = this.pendingMessages.get(companyId);
    if (!companyMessages) {
      return;
    }
    
    const promises = [];
    for (const [chatId, chatData] of companyMessages) {
      if (chatData.timer) {
        clearTimeout(chatData.timer);
        promises.push(this.sendGroupedMessage(companyId, chatId, () => {}));
      }
    }
    
    await Promise.all(promises);
    this.pendingMessages.delete(companyId);
  }

  /**
   * Obtiene estadísticas de mensajes pendientes
   */
  getPendingStats() {
    const stats = {};
    for (const [companyId, companyMessages] of this.pendingMessages) {
      stats[companyId] = {};
      for (const [chatId, chatData] of companyMessages) {
        stats[companyId][chatId] = {
          pendingMessages: chatData.messages.length,
          contactName: chatData.contactInfo.name
        };
      }
    }
    return stats;
  }
}

// Exportar una instancia singleton
export default new MessageDebounceService();
