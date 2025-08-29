import axios from "axios";
import { getClient, saveIncomingMessage, getAllMessages } from "./whatsapp.service.js";
import { isChatbotActive } from './configChatbot.service.js'
import chatStateService from "./chatStateService.js";
import Contact from '../models/Contact/Contact.js';

const listenersRegistrados = new Set(); // 👈 Para evitar múltiples registros

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
        try {
          const endpoint = process.env.N8N_WEBHOOK;
          const payloadEnviar = {
            whatsappData: payload,
            companyId: companyId,
          };
          const respuesta = await sendToN8n(payloadEnviar, endpoint);

          //const respuesta = await axios.post(endpoint, payload);

          if (respuesta) {
            console.log("Enviando respuesta del bot:", respuesta);
            await client.sendMessage(from, respuesta);
            saveIncomingMessage(companyId, payload, respuesta);

            // Emitir mensaje enviado al socket
            const sentPayload = {
              numero: from,
              nombre: null,
              mensaje: respuesta,
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
