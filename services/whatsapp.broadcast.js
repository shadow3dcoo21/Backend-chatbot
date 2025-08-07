import axios from "axios";
import { getClient, saveIncomingMessage, getAllMessages } from "./whatsapp.service.js";
import { obtenerRespuestaFAQ } from '../controllers/faq.controller.js'
import { isChatbotActive } from './configChatbot.service.js'
import chatStateService from "./chatStateService.js";
import Contact from '../models/Contact/Contact.js';
import User from '../models/Users/User.js';

const listenersRegistrados = new Set(); // 👈 Para evitar múltiples registros

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
    };
    // Comprobar si el número está excluido del flujo de n8n
    const fromNumber = from.replace('@c.us', '');
    const contactDb = await Contact.findByCompanyAndNumber(companyId, fromNumber);
    const isExcluded = contactDb?.excludedFromN8n === true;

    if (isExcluded) {
      // Solo almacenar y mostrar, NO enviar a n8n
      saveIncomingMessage(companyId, payload, null);
      global.io.to(companyId).emit("new_message", payload);
      console.log("emisión de evento para companyid:", companyId)
      console.log("emisión de evento para payload:", payload)
      console.log(`Mensaje de ${from} excluido del flujo n8n para company ${companyId}`);
      return;
    }

    console.log("📩 Nuevo mensaje válido broadcast:", payload);
    global.io.to(companyId).emit("new_message", payload);

    try {
      const chatState = await chatStateService.getChatState(companyId, from);
      const globalStateBot = await isChatbotActive(companyId)
      if (chatState.botActive && globalStateBot) {
        const respuestaFAQ = obtenerRespuestaFAQ(body);
        if (respuestaFAQ) {
          console.log("Enviando respuesta de FAQ", respuestaFAQ);
          await client.sendMessage(from, respuestaFAQ);
          saveIncomingMessage(companyId, payload, respuestaFAQ);
          const sentPayload = {
            numero: from,
            nombre: null,
            mensaje: respuestaFAQ,
            hora: new Date().toISOString(),
            tipo: "enviado"
          };
          global.io.to(companyId).emit("new_message", sentPayload);
          console.log("emisión de evento para companyid:", companyId)
          console.log("emisión de evento para payload:", sentPayload)
          return;
        }

        // Process with n8n webhook if no FAQ match
        try {
          const endpoint = process.env.N8N_WEBHOOK;
          const respuesta = await axios.post(endpoint, payload);

          if (respuesta.data?.respuesta) {
            console.log("Enviando respuesta del bot:", respuesta.data.respuesta);
            await client.sendMessage(from, respuesta.data.respuesta);
            saveIncomingMessage(companyId, payload, respuesta.data.respuesta);

            // Emitir mensaje enviado al socket
            const sentPayload = {
              numero: from,
              nombre: null,
              mensaje: respuesta.data.respuesta,
              hora: new Date().toISOString(),
              tipo: "enviado"
            };
            global.io.to(companyId).emit("new_message", sentPayload);
            console.log("emisión de evento para companyid:", companyId)
            console.log("emisión de evento para payload:", sentPayload)
          } else {
            saveIncomingMessage(companyId, payload, null);
          }
        } catch (err) {
          console.error("❌ Error en webhook:", err.message);
          saveIncomingMessage(companyId, payload, null);
        }
      } else {
        // Bot is inactive for this chat, just save the message
        console.log("Bot inactivo para este chat, solo guardando mensaje");
        saveIncomingMessage(companyId, { ...payload, tipo: "recibido" }, null);
      }
    } catch (err) {
      console.error("❌ Error conectando con n8n:", err.message);
      saveIncomingMessage(companyId, payload, null);
    }
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
