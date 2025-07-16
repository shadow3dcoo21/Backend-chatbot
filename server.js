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

// Rutas principales
app.get('/', (req, res) => {
  res.status(200).send('Bienvenido a la API');
});

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

// Aplicar rutas
app.use('/api/auth', authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/whatsapp/status", statusRoutes);
app.use("/api/whatsapp/start", whatsappStartRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/contacts', contactRoutes);

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Algo salió mal',
    message: err.message,
  });
});

// WebSocket personal por usuario (registro de salas)
io.on('connection', (socket) => {
  socket.on('register', (userId) => {
    console.log(`📡 Usuario ${userId} registrado en sala WebSocket`);
    socket.join(userId); // Cada usuario tiene su propia sala
  });

  socket.on('disconnect', () => {
    console.log('🛑 Cliente desconectado');
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ws://localhost:${PORT}`);
  console.log(`🌐 CORS configurado para dominios permitidos`);
});

// Exportar para pruebas u otros usos
export { app, server, io };
