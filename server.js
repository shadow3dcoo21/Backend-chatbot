import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import connectDB from './config/db/db.js';

// Configuración de CORS
import { corsOptions } from './config/cors/cors.js';

// Inicializar la aplicación
const app = express();
dotenv.config();

// Conexión a la base de datos
connectDB();

// Crear servidor HTTP
const server = http.createServer(app);

// Configurar WebSocket
import { setupWebSocket } from './websocket/socket.js';
const io = setupWebSocket(server);
global.io = io;

// Middlewares globales
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importar rutas
import botRoutes from './routes/bot.routes.js';

// Rutas principales
app.get('/', (req, res) => {
  res.status(200).send('Bienvenido a la API');
});

// Rutas de la API
app.use('/api/bot', botRoutes);

app.get('/api/test-socket', (req, res) => {
  const connectedClients = io.engine.clientsCount;
  const rooms = Array.from(io.sockets.adapter.rooms.keys());

  res.json({
    message: 'Socket.io está funcionando',
    connectedClients,
    rooms,
    timestamp: new Date().toISOString(),
    transport: 'WebSocket available'
  });
});

// Rutas de autenticación y funcionalidad
import authRoutes from './routes/auth/auth.routes.js';
import qrRoutes from './routes/chat/qr.routes.js';
import messageRoutes from './routes/chat/message.routes.js';
import statusRoutes from './routes/chat/status.routes.js';
import whatsappStartRoutes from './routes/whatsapp/start.routes.js';
import userRoutes from './routes/auth/user.routes.js';
import companyRoutes from './routes/company.routes.js';
import contactRoutes from './routes/contact.routes.js';
import configChatbotRoutes from './routes/chat/configchatbot.routes.js';
import productRoutes from './routes/product.routes.js';

// Aplicar rutas
app.use('/api/auth', authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/whatsapp/status", statusRoutes);
app.use("/api/whatsapp/start", whatsappStartRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/configchatbot', configChatbotRoutes);
app.use('/api/products', productRoutes);

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Algo salió mal',
    message: err.message,
  });
});

// Importar el modelo de Compañía para validaciones
import Company from './models/Company/Company.js';

// WebSocket con registro de usuarios y compañías
io.on('connection', (socket) => {
  // Registrar un usuario en una sala de compañía
  socket.on('register', async ({ userId, companyId }) => {
    try {
      if (!userId || !companyId) {
        console.warn('Intento de registro sin userId o companyId');
      }

      // Verificar que el usuario pertenezca a la compañía
      const company = await Company.findOne({
        _id: companyId,
        'members.userId': userId,
        'members.status': 'active'
      });

      if (!company) {
        console.warn(`Usuario ${userId} intentó registrarse en compañía no autorizada ${companyId}`);
      }

      // Unirse a la sala de la compañía
      socket.join(companyId);

    } catch (error) {
      console.error('Error en registro de WebSocket:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('🛑 Cliente desconectado');
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3005;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ws://localhost:${PORT}`);
  console.log(`🌐 CORS configurado para dominios permitidos`);
});

// Exportar para pruebas u otros usos
export { app, server, io };
