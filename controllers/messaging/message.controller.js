// src/controllers/message.controller.js

const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const upload = multer({ dest: "mensajes/" });
const jwt = require("jsonwebtoken");
const {
  getClient,
  saveIncomingMessage,
  getAllMessages,
} = require("../../services/whatsapp.service");

/**
 * Envío individual
 */
const { getIO } = require("../../websocket/socket"); 

exports.sendMessage = async (req, res) => {
  const { numero, mensaje } = req.body;

  // 🔐 Extraer userId desde el token
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split(" ")[1];

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.userId || decoded.id;
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }

  const chatId = numero.endsWith("@c.us") ? numero : numero + "@c.us";

  try {
    await getClient(userId).sendMessage(chatId, mensaje);

    const payload = {
      numero: chatId,
      nombre: null,
      mensaje,
      hora: new Date().toISOString(),
    };

    // 🧠 Guardar mensaje en memoria como "mensaje enviado"
    saveIncomingMessage(userId, {
      numero: chatId,
      nombre: null,
      mensaje,
      hora: new Date().toISOString(),
      tipo: "enviado", // 🆕
    });

    // 🛰️ Emitirlo también a WebSocket para que aparezca en el chat
    const io = getIO();
    if (io) {
      io.to("words_updates").emit("new_message", {
        ...payload,
        userId,
      });
    }

    return res.json({ status: "Mensaje enviado correctamente" });
  } catch (err) {
    console.error("❌ Error al enviar mensaje:", err);
    return res.status(500).json({ error: err.message || "Error desconocido al enviar" });
  }
};
/**
 * Masivo desde CSV (mantenerlo como estaba)
 */
exports.sendMassiveMessagesFromCsv = [
  upload.single("archivo"),
  (req, res) => {
    const ruta = req.file.path;
    const contactos = [];

    fs.createReadStream(ruta)
      .pipe(csv())
      .on("data", (row) => contactos.push(row))
      .on("end", async () => {
        for (const contacto of contactos) {
          const numero = contacto.numero + "@c.us";
          const mensaje = contacto.mensaje;
          try {
            await getClient().sendMessage(numero, mensaje);
            console.log(`✅ Enviado a ${contacto.numero}`);
          } catch (err) {
            console.log(`❌ Error con ${contacto.numero}: ${err.message}`);
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
        res.json({ status: "masivo CSV completado", total: contactos.length });
      });
  },
];

/**
 * Masivo desde TXT (mantenerlo como estaba)
 */
exports.sendMassiveMessagesFromTxt = [
  multer({ dest: "mensajes_txt/" }).single("archivoTxt"),
  async (req, res) => {
    try {
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
          await getClient().sendMessage(numero, mensajeRaw);
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
exports.sendMassiveMessagesFromList = async (req, res) => {
  try {
    const { numeros, mensaje } = req.body;
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
    const client = getClient();
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
exports.getReceivedMessages = (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;

    const mensajes = getAllMessages(userId);
    return res.json(mensajes.slice(-100).reverse());
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};