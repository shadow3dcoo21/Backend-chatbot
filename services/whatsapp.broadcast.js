import axios from "axios";
import {
  getClient,
  saveIncomingMessage,
  getAllMessages,
} from "./whatsapp.service.js";
import { obtenerRespuestaFAQ } from "../controllers/faq.controller.js";
import { isChatbotActive } from "./configChatbot.service.js";
import chatStateService from "./chatStateService.js";

// Función auxiliar para hacer POST HTTP a n8n
// Esta función maneja la comunicación HTTP con n8n, no es un websocket
// Parámetros:
// - payload: Los datos del mensaje a enviar (ya envuelto en {whatsappData: ...})
// - endpoint: La URL del webhook de n8n
async function sendToN8n(payload, endpoint) {
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
    if (respuesta.data?.reply?.content) {
      console.log(
        "✅ Respuesta recibida del agente:",
        respuesta.data.reply.content
      );
      return respuesta.data.reply.content;
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
    console.log("Mensaje", msg);
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
    // Save and emit the message
    console.log("📩 Nuevo mensaje válido broadcast:", payload);
    global.io.to(userId).emit("new_message", payload);

    try {
      // Get or initialize chat state for this chat
      const chatState = await chatStateService.getChatState(userId, from);
      const globalStateBot = await isChatbotActive(userId);
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

        // Process with n8n via HTTP POST (not websocket)
        // This sends the message data to n8n for AI processing
        // The function sendToN8n handles the HTTP POST request with proper error handling
        const endpoint = process.env.N8N_WEBHOOK;

        // Envolver el payload en un objeto con clave "whatsappData"
        const payloadEnviar = {
          whatsappData: payload,
        };

        const respuestaN8n = await sendToN8n(payloadEnviar, endpoint);

        if (respuestaN8n) {
          await client.sendMessage(from, respuestaN8n);
          saveIncomingMessage(userId, payload, respuestaN8n);
        } else {
          saveIncomingMessage(userId, payload, null);
        }
      } else {
        // Bot is inactive for this chat, just save the message
        console.log("Bot inactivo para este chat, solo guardando mensaje");
        saveIncomingMessage(userId, { ...payload, tipo: "recibido" }, null);
      }
    } catch (err) {
      console.error(
        "❌ Error general en el procesamiento del mensaje:",
        err.message
      );
      saveIncomingMessage(userId, payload, null);
    }
    console.log("Lista de mensajes", getAllMessages(userId));
  });

  client.on("message_create", async (msg) => {
    if (msg.fromMe) {
      console.log("Mensaje propio", msg);
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
        tipo: "enviado",
      });

      // Emitir a través de WebSocket
      global.io.to(userId).emit("new_message", {
        ...payload,
        userId,
        tipo: "enviado",
      });
    }
  });
}

export { setupWhatsAppSocketBroadcast };
