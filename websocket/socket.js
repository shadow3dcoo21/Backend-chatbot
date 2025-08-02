import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { whitelist } from '../config/cors/cors.js';

let ioGlobal = null; // Se usará para acceder al io desde otros archivos

function setupWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin || whitelist.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('No permitido por CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
  });

  ioGlobal = io; // Guardamos la instancia global

  // Middleware para autenticar cada conexión con JWT
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    const companyId = socket.handshake.auth.companyId
    console.log("🧪 TOKEN RECIBIDO EN BACKEND:", token);

    if (!token) {
      console.log("❌ Token no proporcionado");
      return next(new Error("Token requerido"));
    }
    if (!companyId) {
      return next(new Error("ID de compañía requerido"));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      socket.companyId = companyId;
      console.log("🔓 Token válido, usuario autenticado:", decoded);
      next();
    } catch (error) {
      console.log("❌ Error al verificar token:", error.message);
      return next(new Error("Token inválido"));
    }
  });

  // Evento de conexión por usuario
  io.on('connection', (socket) => {
    const companyId = socket.companyId || "undefined";
    console.log(`✅ Usuario conectado: ${companyId} - Socket ID: ${socket.id}`);

    socket.join('words_updates');
    console.log(`Usuario ${companyId} automáticamente unido a words_updates`);

    socket.on('join_words_room', () => {
      socket.join('words_updates');
      console.log(`🟢 Usuario ${companyId} se unió manualmente a words_updates`);
      socket.emit('joined_room', { room: 'words_updates', success: true });
    });

    socket.on('ping', (callback) => {
      console.log(`📶 Ping recibido de ${companyId}`);
      if (callback) callback('pong');
    });

    socket.on('test_connection', (data, callback) => {
      console.log(`🧪 Test recibido de ${companyId}:`, data);
      const response = {
        message: 'Conexión WebSocket funcionando correctamente',
        timestamp: new Date().toISOString(),
        clientData: data
      };
      if (callback) callback(response);
      socket.emit('test_response', response);
    });

    socket.on('disconnect', (reason) => {
      console.log(`❌ Usuario desconectado: ${companyId} - Razón: ${reason}`);
    });

    socket.on('error', (error) => {
      console.log(`❌ Error en socket ${companyId}:`, error);
    });
  });

  return io;
}

function getIO() {
  return ioGlobal;
}

// Exportamos tanto la función como el getter de ioGlobal
export { setupWebSocket, getIO };
