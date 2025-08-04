
const whitelist = [
  'https://localhost:3000',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://chatbot.elaria.com.pe',
  'https://elaria.com.pe',
  'https://www.elaria.com.pe',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

export { corsOptions, whitelist };
