import axios from "axios";
import { getClient, saveIncomingMessage, getAllMessages } from "./whatsapp.service.js";
import { obtenerRespuestaFAQ } from '../controllers/faq.controller.js'
import { isChatbotActive } from './configChatbot.service.js'
import chatStateService from "./chatStateService.js";
import Contact from '../models/Contact/Contact.js';
import User from '../models/Users/User.js';

const listenersRegistrados = new Set(); // 👈 Para evitar múltiples registros

function setupWhatsAppSocketBroadcast(userId) {
  const client = getClient(userId);
  if (!client) {
    console.warn(`⚠️ Cliente WhatsApp no inicializado para ${userId}`);
    return;
  }

  // ✅ Verificar si ya se registró el listener
  if (listenersRegistrados.has(userId)) {
    console.log(`ℹ️ Listener ya registrado para ${userId}`);
    return;
  }
  listenersRegistrados.add(userId); // Marcar como registrado

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
    };

    // Obtener companyId del usuario
    let companyId = null;
    try {
      const user = await User.findById(userId).select('companyRef');
      companyId = user?.companyRef;
    } catch (err) {
      console.error('No se pudo obtener companyId para el usuario:', err);
    }

    // Comprobar si el número está excluido del flujo de n8n
    let isExcluded = false;
    if (companyId) {
      const fromNumber = from.replace('@c.us', '');
      const fromNumberContact = contact.number
      console.log("Numero from Contact object:", fromNumberContact)
      const contactDb = await Contact.findByCompanyAndNumber(companyId, fromNumber);
      isExcluded = contactDb?.excludedFromN8n === true;
    }

    if (isExcluded) {
      // Solo almacenar y mostrar, NO enviar a n8n
      saveIncomingMessage(userId, payload, null);
      global.io.to(userId).emit("new_message", payload);
      console.log(`Mensaje de ${from} excluido del flujo n8n para company ${companyId}`);
      return;
    }

    console.log("📩 Nuevo mensaje válido broadcast:", payload);
    global.io.to(userId).emit("new_message", payload);

    try {
      // Get or initialize chat state for this chat
      const chatState = await chatStateService.getChatState(userId, from);
      const globalStateBot = await isChatbotActive(userId)
      // Only process bot logic if active for this chat
      if (chatState.botActive && globalStateBot) {
        // Check FAQ first
        const respuestaFAQ = obtenerRespuestaFAQ(body);
        if (respuestaFAQ) {
          console.log("Enviando respuesta de FAQ", respuestaFAQ);
          await client.sendMessage(from, respuestaFAQ);
          saveIncomingMessage(userId, payload, respuestaFAQ);
          return;
        }

        // Process with n8n webhook if no FAQ match
        try {
          const endpoint = process.env.N8N_WEBHOOK;
          const respuesta = await axios.post(endpoint, payload);

          if (respuesta.data?.respuesta) {
            console.log("Enviando respuesta del bot:", respuesta.data.respuesta);
            await client.sendMessage(from, respuesta.data.respuesta);
            saveIncomingMessage(userId, payload, respuesta.data.respuesta);
          } else {
            saveIncomingMessage(userId, payload, null);
          }
        } catch (err) {
          console.error("❌ Error en webhook:", err.message);
          saveIncomingMessage(userId, payload, null);
        }
      } else {
        // Bot is inactive for this chat, just save the message
        console.log("Bot inactivo para este chat, solo guardando mensaje");
        saveIncomingMessage(userId, { ...payload, tipo: "recibido" }, null);
      }
    } catch (err) {
      console.error("❌ Error conectando con n8n:", err.message);
      saveIncomingMessage(userId, payload, null);
    }
    console.log("Lista de mensajes", getAllMessages(userId))
  });

  client.on("message_create", async (msg) => {
    if (msg.fromMe) {
      console.log("Mensaje propio", msg)
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
      saveIncomingMessage(userId, {
        ...payload,
        tipo: "enviado"
      });

      // Emitir a través de WebSocket
      global.io.to(userId).emit("new_message", {
        ...payload,
        userId,
        tipo: "enviado"
      });
    }
  })
}

export { setupWhatsAppSocketBroadcast };
