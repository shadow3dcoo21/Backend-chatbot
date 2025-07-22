import axios from "axios";
import { getAllMessages, getClient, saveIncomingMessage } from "./whatsapp.service.js";
import { isChatbotActive } from "./configChatbot.service.js";
import { obtenerRespuestaFAQ } from "../controllers/faq.controller.js"

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
    // Consultar si el chatbot está activo para este usuario
    const activo = await isChatbotActive(userId);
    console.log("📩 Nuevo mensaje válido broadcast:", payload);
    global.io.to(userId).emit("new_message", payload);
    if (!activo) {
      saveIncomingMessage(userId, payload, null);
      return;
    }

    // Consultar FAQ antes de seguir
    const respuestaFAQ = obtenerRespuestaFAQ(body);
    if (respuestaFAQ) {
      console.log("Enviando respuesta de FAQ", respuestaFAQ)
      await client.sendMessage(from, respuestaFAQ);
      // global.io.to(userId).emit("new_bot_response", {
      //   numero: from,
      //   nombre: contact.pushname,
      //   mensaje: respuestaFAQ,
      //   hora: new Date().toISOString(),
      //   tipo: "enviado"
      // });
      saveIncomingMessage(userId, payload, respuestaFAQ);
      return;
    }

    try {
      const endpoint = process.env.N8N_WEBHOOK
      const respuesta = await axios.post(endpoint, payload);
      if (respuesta.data?.respuesta) {
        console.log("Enviando mensaje", respuesta.data.respuesta)
        await client.sendMessage(from, respuesta.data.respuesta);

        // global.io.to(userId).emit("new_message", {
        //   numero: from,
        //   nombre: contact.pushname,
        //   mensaje: respuesta.data.respuesta,
        //   hora: new Date().toISOString(),
        //   tipo: "enviado"
        // });
        console.log("Mensaje enviado")
        saveIncomingMessage(userId, payload, respuesta.data.respuesta);
      } else {
        saveIncomingMessage(userId, payload, null);
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
