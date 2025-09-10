import axios from "axios";
import { getClient, saveIncomingMessage, getAllMessages } from "./whatsapp.service.js";
import { isChatbotActive } from './configChatbot.service.js'
import chatStateService from "./chatStateService.js";
import Contact from '../models/Contact/Contact.js';
import messageDebounceService from './messageDebounceService.js';

const listenersRegistrados = new Set(); // 👈 Para evitar múltiples registros

async function sendToIAAgent(payload, endpoint) {
  const axiosConfig = {
    timeout: 50000,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "WhatsApp-Bot/1.0",
    },
  };

  try {
    console.log("�� Enviando POST HTTP al agente:", endpoint);
    console.log("�� Payload enviado:", JSON.stringify(payload, null, 2));
    const respuesta = await axios.post(endpoint, payload, axiosConfig);

    // CAMBIAR ESTA LÍNEA:
    if (respuesta.data?.response?.content) {
      console.log(
        "✅ Respuesta recibida del agente:",
        respuesta.data.response.content
      );
      return respuesta.data.response.content;
    } else {
      console.log("⚠️ Agente no devolvió respuesta válida");
      console.log(
        "�� Respuesta completa:",
        JSON.stringify(respuesta.data, null, 2)
      );
      return null;
    }
  } catch (err) {
    console.error("❌ Error en POST HTTP al agente:", err.message);
    return null;
  }
}

/**
 * Función para enviar mensajes agrupados a N8N
 */
async function sendGroupedMessageToN8n(companyId, groupedPayload) {
  try {
    const chatState = await chatStateService.getChatState(companyId, groupedPayload.numero);
    const globalStateBot = await isChatbotActive(companyId);

    if (chatState.botActive && globalStateBot) {
      const endpoint = process.env.N8N_WEBHOOK;

      // 🗂️ Obtener historial de conversación
      const fromNumber = groupedPayload.numero.replace('@c.us', '');
      const conversationHistory = await Contact.getConversationHistory(companyId, fromNumber, 20);

      const payloadEnviar = {
        whatsappData: groupedPayload,
        messageId: groupedPayload.messageIds[groupedPayload.messageIds.length - 1], // Usar el último messageId
        companyId: companyId,
        conversationHistory: conversationHistory,
        isGrouped: true
      };

      console.log(`📚 Enviando mensaje agrupado con historial de conversación a N8N`);
      const respuesta = await sendToN8n(payloadEnviar, endpoint);

      if (respuesta) {
        console.log("Enviando respuesta del bot para mensaje agrupado:", respuesta);
        const client = getClient(companyId);
        const sentMessage = await client.sendMessage(groupedPayload.numero, respuesta);

        // 🗄️ Guardar respuesta del bot en la base de datos
        try {
          await Contact.addMessage(companyId, fromNumber, {
            content: respuesta,
            timestamp: new Date(),
            direction: 'outgoing',
            isAutomated: true,
            messageId: sentMessage.id._serialized,
            nombre: groupedPayload.nombre
          });
          console.log(`✅ Respuesta del bot para mensaje agrupado guardada en BD para ${fromNumber}`);
        } catch (error) {
          console.error('❌ Error al guardar respuesta del bot en BD:', error);
        }

        // Emitir mensaje enviado al socket
        const sentPayload = {
          numero: groupedPayload.numero,
          nombre: groupedPayload.nombre,
          mensaje: respuesta,
          hora: new Date().toISOString(),
          tipo: "enviado",
          isGrouped: true
        };
        global.io.to(companyId).emit("new_message", sentPayload);
        console.log("emisión de evento para companyid:", companyId);
        console.log("emisión de evento para payload:", sentPayload);
      }
    } else {
      console.log("Bot inactivo para mensaje agrupado, solo guardando mensaje");
    }
  } catch (error) {
    console.error("❌ Error al procesar mensaje agrupado:", error);
  }
}

function setupWhatsAppSocketBroadcast(companyId) {
  const client = getClient(companyId);
  if (!client) {
    console.warn(`⚠️ Cliente WhatsApp no inicializado para la compañia${companyId}`);
    return;
  }

  // ✅ Verificar si ya se registró el listener
  if (listenersRegistrados.has(companyId)) {
    console.log(`ℹ️ Listener ya registrado para la compañia${companyId}`);
    return;
  }
  listenersRegistrados.add(companyId); // Marcar como registrado

  client.on("message", async (msg) => {
    console.log("Mensaje", msg)
    if (msg.isGroupMsg || msg.from === "status@broadcast") {
      return;
    }

    const from = msg.from?.trim();
    if (!from || !from.endsWith("@c.us")) {
      return;
    }

    const body = msg.body?.trim();
    if (!body) {
      return;
    }

    const contact = await msg.getContact();
    const payload = {
      numero: from,
      nombre: contact.pushname || "Desconocido",
      mensaje: body,
      hora: new Date().toISOString(),
      companyId: companyId,
      messageId: msg.id._serialized
    };

    // Comprobar si el número está excluido del flujo de n8n
    const fromNumber = from.replace('@c.us', '');
    const contactDb = await Contact.findByCompanyAndNumber(companyId, fromNumber);
    const isExcluded = contactDb?.excludedFromN8n === true;

    // 🗄️ Guardar mensaje recibido en la base de datos inmediatamente
    try {
      const cleanNumber = from.replace('@c.us', '');
      await Contact.addMessage(companyId, cleanNumber, {
        content: body,
        timestamp: new Date(),
        direction: 'incoming',
        isAutomated: false,
        messageId: msg.id._serialized,
        nombre: contact.pushname || "Desconocido"
      });
      console.log(`✅ Mensaje recibido guardado en BD para ${cleanNumber}`);
    } catch (error) {
      console.error('❌ Error al guardar mensaje recibido en BD:', error);
    }

    // Emitir mensaje inmediatamente al frontend
    global.io.to(companyId).emit("new_message", payload);
    console.log("📩 Mensaje emitido al frontend:", payload);

    if (isExcluded) {
      console.log(`Mensaje de ${from} excluido del flujo n8n para company ${companyId}`);
      return;
    }

    // 🕐 Usar sistema de debounce para agrupar mensajes
    console.log(`⏱️ Agregando mensaje al buffer de debounce para ${from}`);
    messageDebounceService.addMessage(companyId, from, payload, (groupedPayload) => {
      return sendGroupedMessageToN8n(companyId, groupedPayload);
    });
    console.log("Lista de mensajes", getAllMessages(companyId))
  });

  client.on("message_create", async (msg) => {
    if (msg.fromMe) {
      console.log("Mensaje propio", msg.body)
      const chat = await msg.getChat();
      const contact = await msg.getContact();
      const chatId = chat.id._serialized;
      const from = msg.from?.trim();
      const payload = {
        numero: chatId,
        nombre: null,
        mensaje: msg.body,
        hora: new Date().toISOString(),
      };

      // Guardar mensaje en memoria como "enviado"
      saveIncomingMessage(companyId, {
        ...payload,
        tipo: "enviado"
      });

      // Emitir a través de WebSocket
      global.io.to(companyId).emit("new_message", {
        ...payload,
        companyId,
        tipo: "enviado"
      });
      console.log("emisión de evento para companyid:", companyId)
      console.log("emisión de evento para payload:", payload)
    }
  })
}

export { setupWhatsAppSocketBroadcast };
