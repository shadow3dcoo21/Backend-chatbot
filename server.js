const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db/db');

// Configuración de CORS
const { corsOptions } = require('./config/cors/cors');

// Inicializar la aplicación
const app = express();
dotenv.config();

// Conexión a la base de datos
connectDB();

// Crear servidor HTTP
const server = http.createServer(app);

// Configurar WebSocket
const { setupWebSocket } = require('./websocket/socket');
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
const authRoutes = require('./routes/auth/authRoutes');
const qrRoutes = require("./routes/chat/qr.routes");
const messageRoutes = require("./routes/chat/message.routes");
const statusRoutes = require("./routes/chat/status.routes");
const whatsappStartRoutes = require('./routes/whatsapp/start.routes'); // 🚀 Nueva ruta

// Aplicar rutas
app.use('/api/auth', authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/whatsapp/status", statusRoutes);
app.use("/api/whatsapp/start", whatsappStartRoutes); // 🚀 Nueva ruta

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
module.exports = { app, server, io };
