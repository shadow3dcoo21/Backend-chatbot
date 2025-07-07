const axios = require("axios");
const { getClient, saveIncomingMessage } = require("./whatsapp.service");

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
    const contact = await msg.getContact();
    const payload = {
      numero: msg.from,
      nombre: contact.pushname || "Desconocido",
      mensaje: msg.body,
      hora: new Date().toISOString(),
    };

    console.log("📩 Nuevo mensaje recibido:", payload);

    global.io.to(userId).emit("new_message", payload);

    try {
      const respuesta = await axios.post(process.env.N8N_WEBHOOK, payload);

      if (respuesta.data?.respuesta) {
        await client.sendMessage(msg.from, respuesta.data.respuesta);

        global.io.to(userId).emit("new_bot_response", {
          numero: msg.from,
          respuesta: respuesta.data.respuesta,
          hora: new Date().toISOString(),
        });

        saveIncomingMessage(userId, payload, respuesta.data.respuesta);
      } else {
        saveIncomingMessage(userId, payload, null);
      }
    } catch (err) {
      console.error("❌ Error al conectar con n8n:", err.message);
      saveIncomingMessage(userId, payload, null);
    }
  });
}

module.exports = { setupWhatsAppSocketBroadcast };
