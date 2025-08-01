import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require('whatsapp-web.js');
import qrcode from "qrcode";
import fs from "fs";
import path from "path";
import { getIO } from "../websocket/socket.js";

const clients = new Map(); // Aquí se guardan todos los clientes activos por companyId
const qrCodes = new Map(); // Aquí se guarda el QR por companyId
const mensajesPorCompany = new Map(); // Aquí se guarda el historial por companyId

function initializeWhatsappClient(companyId) {
  if (clients.has(companyId)) {
    return clients.get(companyId); // Ya existe cliente para esta compañía
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: companyId }),
    puppeteer: { headless: true },
  });

  client.on("qr", async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    qrCodes.set(companyId, qrImage);
    console.log(`📸 QR generado para la compañía ${companyId}`);

    // Emitir QR a todos los usuarios de la compañía
    const io = getIO();
    if (io) {
      io.to(`company_${companyId}`).emit("qr_updated", { qrImage, companyId });
    }
  });

  client.on("ready", () => {
    console.log(`✅ WhatsApp listo para la compañía ${companyId}`);
  });

  client.on("authenticated", () => {
    console.log(`🔐 Compañía ${companyId} autenticada`);

    // Notificar a todos los usuarios de la compañía
    const io = getIO();
    if (io) {
      io.to(companyId).emit("whatsapp_authenticated", { companyId });
    }
  });

  client.on("disconnected", (reason) => {
    console.log(`🔌 Compañía ${companyId} desconectada: ${reason}`);
    clients.delete(companyId);

    if (reason === "LOGOUT") {
      // Borrar mensajes de la compañía
      if (mensajesPorCompany) {
        mensajesPorCompany.delete(companyId);
        console.log(`Mensajes de compañía ${companyId} eliminados de la memoria.`);
      }
    }

    // Notificar a todos los usuarios de la compañía
    const io = getIO();
    if (io) {
      io.to(companyId).emit("whatsapp_disconnected", { companyId, reason });
    }
  });

  client.initialize();
  clients.set(companyId, client);
  return client;
}

function getClient(companyId) {
  return clients.get(companyId);
}

async function getContacts(companyId) {
  const client = clients.get(companyId);
  return await client.getContacts()
}

function isClientReady(companyId) {
  const client = clients.get(companyId);
  return client ? client.info?.wid?.user : false;
}

function getQrImage(companyId) {
  return qrCodes.get(companyId);
}

function saveIncomingMessage(companyId, payload, respuesta = null) {
  const entry = { ...payload, respuesta };

  if (!mensajesPorCompany.has(companyId)) {
    mensajesPorCompany.set(companyId, []);
  }

  mensajesPorCompany.get(companyId).push(entry);
}

function getAllMessages(companyId) {
  return mensajesPorCompany.get(companyId) || [];
}

function eliminarSesion(companyId) {
  const sessionPath = path.join(__dirname, "..", ".wwebjs_auth", companyId);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    console.log(`🧹 Sesión WhatsApp de compañía ${companyId} eliminada`);
  }
  clients.delete(companyId);
  qrCodes.delete(companyId);
  mensajesPorCompany.delete(companyId);
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
