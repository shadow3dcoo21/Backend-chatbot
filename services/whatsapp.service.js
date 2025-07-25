import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require('whatsapp-web.js');
import qrcode from "qrcode";
import fs from "fs";
import path from "path";
import { getIO } from "../websocket/socket.js";

const clients = new Map(); // Aquí se guardan todos los clientes activos
const qrCodes = new Map(); // Aquí se guarda el QR por usuario
const mensajesPorUsuario = new Map(); // Aquí se guarda el historial por usuario

function initializeWhatsappClient(userId) {
  if (clients.has(userId)) {
    return clients.get(userId); // Ya existe cliente para este usuario
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: { headless: true },
  });
  client.on("qr", async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    qrCodes.set(userId, qrImage);
    console.log(`📸 QR generado para el usuario ${userId}`);
  });

  client.on("ready", () => {
    console.log(`✅ WhatsApp listo para el usuario ${userId}`);
  });

  client.on("authenticated", () => {
    console.log(`🔐 Usuario ${userId} autenticado`);
  });

  client.on("disconnected", (reason) => {
    console.log(`🔌 Usuario ${userId} desconectado: ${reason}`);
    clients.delete(userId);
    if (reason === "LOGOUT") {
      // 1. Borrar carpeta de sesión
      // const sessionPath = path.join(__dirname, '..', '.wwebjs_auth', `session-${userId}`);
      // fs.rm(sessionPath, { recursive: true, force: true }, (err) => {
      //   if (err) {
      //     console.error(`Error al borrar la carpeta de sesión de ${userId}:`, err);
      //   } else {
      //     console.log(`Carpeta de sesión de ${userId} eliminada correctamente.`);
      //   }
      // });
  
      // Borrar mensajes del usuario
      if (mensajesPorUsuario) { // Si usas un Map en memoria
        mensajesPorUsuario.delete(userId);
        console.log(`Mensajes de ${userId} eliminados de la memoria.`);
      }
    }
  });

 /* client.on("message", async (msg) => {
    if (msg.isGroupMsg || msg.from === "status@broadcast") {
      return;
    }

    const from = msg.from?.trim();
    if (!/^[0-9]+@c\.us$/.test(from)) {
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
      tipo: "recibido",
    };

    if (!mensajesPorUsuario.has(userId)) {
      mensajesPorUsuario.set(userId, []);
    }
    mensajesPorUsuario.get(userId).push(payload);

    const io = getIO();
    if (io) {
      io.to("words_updates").emit("new_message", {
        ...payload,
        userId,
      });
      console.log("📩 Nuevo mensaje válido emitido a WebSocket:", payload);
    } else {
      console.warn("⚠️ WebSocket IO no inicializado");
    }
  });
*/
  client.initialize();
  clients.set(userId, client);
  return client;
}

function getClient(userId) {
  return clients.get(userId);
}

async function getContacts(userId){
  const client = clients.get(userId);
  return await client.getContacts()
}

function isClientReady(userId) {
  const client = clients.get(userId);
  return client ? client.info?.wid?.user : false;
}

function getQrImage(userId) {
  return qrCodes.get(userId);
}

function saveIncomingMessage(userId, payload, respuesta = null) {
  const entry = { ...payload, respuesta };

  if (!mensajesPorUsuario.has(userId)) {
    mensajesPorUsuario.set(userId, []);
  }

  mensajesPorUsuario.get(userId).push(entry);
}

function getAllMessages(userId) {
  return mensajesPorUsuario.get(userId) || [];
}

function eliminarSesion(userId) {
  const sessionPath = path.join(__dirname, "..", ".wwebjs_auth", userId);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    console.log(`🧹 Sesión WhatsApp de ${userId} eliminada`);
  }
  clients.delete(userId);
  qrCodes.delete(userId);
  mensajesPorUsuario.delete(userId);
}

export {
  initializeWhatsappClient,
  getClient,
  getContacts,
  isClientReady,
  getQrImage,
  saveIncomingMessage,
  getAllMessages,
  eliminarSesion,
};
