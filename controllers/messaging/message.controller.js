// src/controllers/message.controller.js

import multer from "multer";
import fs from "fs";
import { getClient, getAllMessages, saveIncomingMessage } from "../../services/whatsapp.service.js";
import jwt from "jsonwebtoken";
const upload = multer({ dest: "mensajes/" });
import chatStateService from "../../services/chatStateService.js";
import Contact from "../../models/Contact/Contact.js";
import { getIO } from "../../websocket/socket.js";

export const sendMessage = async (req, res) => {
  const { numero, mensaje, isAutomated = false } = req.body;
  const companyId = req.params.companyId
  // 🔐 Extraer userId desde el token
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split(" ")[1];

  // let userId;
  // try {
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET);
  //   userId = decoded.userId || decoded.id;
  // } catch (err) {
  //   return res.status(401).json({ error: "Token inválido o expirado" });
  // }

  const chatId = numero.endsWith("@c.us") ? numero : numero + "@c.us";

  try {
    // Verificar si el bot está activo antes de enviar mensajes automatizados
    if (isAutomated) {
      const isBotActive = await chatStateService.isBotActive(companyId, chatId);
      if (!isBotActive) {
        console.log(`[MessageController] Bot inactivo para ${chatId}, omitiendo mensaje automatizado`);
        return res.json({
          status: "Mensaje automatizado omitido - Bot inactivo",
          botActive: false
        });
      }
    } else {
      // Si es un mensaje manual, desactivar el bot por 1 hora
      console.log(`[MessageController] Mensaje manual detectado, desactivando bot para ${chatId} por 1 hora`);
      await chatStateService.setBotState(companyId, chatId, false, true,); // 1 hora
    }

    // Enviar el mensaje
    const sentMessage = await getClient(companyId).sendMessage(chatId, mensaje);

    const payload = {
      numero: chatId,
      nombre: null,
      mensaje,
      hora: new Date().toISOString(),
      isAutomated
    };

    // 🗄️ Guardar mensaje en la base de datos
    try {
      const cleanNumber = numero.replace('@c.us', '');
      await Contact.addMessage(companyId, cleanNumber, {
        content: mensaje,
        timestamp: new Date(),
        direction: 'outgoing',
        isAutomated: isAutomated,
        messageId: sentMessage.id._serialized
      });
      console.log(`✅ Mensaje guardado en BD para ${cleanNumber}`);
    } catch (error) {
      console.error('❌ Error al guardar mensaje en BD:', error);
    }

    // 🧠 Guardar mensaje en memoria (mantener compatibilidad)
    saveIncomingMessage(companyId, {
      numero: chatId,
      nombre: null,
      mensaje,
      hora: new Date().toISOString(),
      tipo: isAutomated ? "automatizado" : "enviado",
    });

    // 🛰️ Emitir a WebSocket si está configurado
    const io = getIO();
    if (io) {
      io.to(companyId).emit("new_message", {
        ...payload,
        companyId,
      });
    }

    return res.json({
      status: "Mensaje enviado correctamente",
      botActive: !isAutomated // Si es manual, el bot se desactiva
    });
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err);
    return res.status(500).json({ error: err.message || "Error desconocido al enviar" });
  }
};
/**
 * Masivo desde CSV (mantenerlo como estaba)
 */
export const sendMassiveMessagesFromCsv = [
  upload.single("archivo"),
  (req, res) => {
    const ruta = req.file.path;
    const contactos = [];
    const companyId = req.params.companyId

    fs.createReadStream(ruta)
      .pipe(csv())
      .on("data", (row) => contactos.push(row))
      .on("end", async () => {
        try {
          for (const contacto of contactos) {
            const numero = contacto.numero + "@c.us";
            const mensaje = contacto.mensaje;

            // Check if bot is active for this chat
            const isBotActive = await chatStateService.isBotActive(companyId, numero);

            // If bot is not active and this is an automated message, don't send it
            if (!isBotActive && req.body.isAutomated) {
              console.log(`[ChatState] Message not sent - bot is inactive for chat ${numero}`);
              continue;
            }

            try {
              await getClient(companyId).sendMessage(numero, mensaje);
              console.log(`✅ Enviado a ${contacto.numero}`);
            } catch (err) {
              console.log(`❌ Error con ${contacto.numero}: ${err.message}`);
            }
            await new Promise((r) => setTimeout(r, 1500));
          }
          res.json({ status: "masivo CSV completado", total: contactos.length });
        } catch (err) {
          console.error("Error al enviar mensajes masivos:", err);
          res.status(500).json({ error: "Error al enviar mensajes masivos" });
        }
      });
  },
];

/**
 * Masivo desde TXT (mantenerlo como estaba)
 */
export const sendMassiveMessagesFromTxt = [
  multer({ dest: "mensajes_txt/" }).single("archivoTxt"),
  async (req, res) => {
    try {
      const companyId = req.params.companyId
      const filePath = req.file.path;
      const contenido = fs.readFileSync(filePath, "utf-8");
      const lineas = contenido
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      let enviados = 0;
      for (const linea of lineas) {
        const indiceComa = linea.indexOf(",");
        if (indiceComa === -1) continue;
        const numeroRaw = linea.slice(0, indiceComa).trim();
        const mensajeRaw = linea.slice(indiceComa + 1).trim();
        if (!numeroRaw || !mensajeRaw) continue;

        const numero = numeroRaw + "@c.us";
        try {
          await getClient(companyId).sendMessage(numero, mensajeRaw);
          enviados++;
          console.log(`✅ [TXT] Enviado a ${numeroRaw}`);
        } catch (err) {
          console.log(`❌ [TXT] Error con ${numeroRaw}: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      fs.unlinkSync(filePath);
      return res.json({ status: "masivo TXT completado", total: enviados });
    } catch (error) {
      console.error("Error procesando TXT masivo:", error);
      return res.status(500).json({ error: "Error en envío masivo TXT" });
    }
  },
];

/**
 * Nuevo: Masivo desde lista de números + texto único
 * Recibe JSON: { numeros: string, mensaje: string }
 * 'numeros' puede ser: "51987654321\n51912345678\n51911122233"
 *   o también: "51987654321,51912345678,51911122233"
 */
export const sendMassiveMessagesFromList = async (req, res) => {
  const companyId = req.params.companyId
  const { numeros, mensaje } = req.body;
  try {
    if (!numeros || !mensaje) {
      return res
        .status(400)
        .json({ error: "Debe enviar 'numeros' y 'mensaje' en el body" });
    }

    // 1. Separemos la lista de números:
    //    - Dividimos por saltos de línea
    //    - Si dentro de cada línea hay comas, dividimos también por comas
    const rawLines = numeros
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Ahora armamos un array de strings con cada número limpio
    let listaNumeros = [];
    for (const line of rawLines) {
      // Si en la línea hay comas, dividimos adicionalmente:
      if (line.includes(",")) {
        const partes = line
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        listaNumeros.push(...partes);
      } else {
        listaNumeros.push(line);
      }
    }

    // Evitar duplicados: opcional
    listaNumeros = Array.from(new Set(listaNumeros));

    // 2. Enviar el mismo mensaje a cada número (añadiendo el sufijo "@c.us")
    const client = getClient(companyId);
    let enviados = 0;

    for (const numeroRaw of listaNumeros) {
      // Validar que sea un número razonable (solo dígitos)
      const cleaned = numeroRaw.replace(/\D/g, "");
      if (cleaned.length < 8) continue; // ignoro strings muy cortos
      const chatId = cleaned + "@c.us";
      try {
        await client.sendMessage(chatId, mensaje);
        enviados++;
        console.log(`✅ [LIST] Enviado a ${cleaned}`);
      } catch (err) {
        console.log(`❌ [LIST] Error con ${cleaned}: ${err.message}`);
      }
      // Pequeña pausa para no saturar
      await new Promise((r) => setTimeout(r, 1500));
    }

    return res.json({ status: "masivo LIST completado", total: enviados });
  } catch (err) {
    console.error("Error en envío masivo LIST:", err);
    return res.status(500).json({ error: "Error en envío masivo LIST" });
  }
};

/**
 * Obtener mensajes recibidos
 */
export const getReceivedMessages = (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split(" ")[1];
  const companyId = req.params.companyId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    const mensajes = getAllMessages(companyId);
    return res.json(mensajes.slice(-100).reverse());
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};

/**
 * Obtener mensajes de un contacto específico desde la base de datos
 */
export const getContactMessages = async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split(" ")[1];
  const { companyId, number } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const messages = await Contact.getMessages(companyId, number, parseInt(limit));
    
    return res.json({
      success: true,
      data: messages,
      total: messages.length
    });
  } catch (err) {
    console.error('Error al obtener mensajes del contacto:', err);
    return res.status(500).json({ 
      error: "Error al obtener mensajes del contacto",
      details: err.message 
    });
  }
};

/**
 * Obtener historial completo de conversación de un contacto
 */
export const getContactConversationHistory = async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split(" ")[1];
  const { companyId, number } = req.params;
  const { limit = 20 } = req.query;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const conversationHistory = await Contact.getConversationHistory(companyId, number, parseInt(limit));
    
    return res.json({
      success: true,
      data: conversationHistory,
      total: conversationHistory.messages.length
    });
  } catch (err) {
    console.error('Error al obtener historial de conversación:', err);
    return res.status(500).json({ 
      error: "Error al obtener historial de conversación",
      details: err.message 
    });
  }
};