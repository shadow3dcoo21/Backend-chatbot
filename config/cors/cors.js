
const whitelist = [
  'https://sordomundo.pro',
  'https://www.sordomundo.pro',
  'https://sordomundo.vercel.app', 
  'http://sordomundo.pro',
  'https://localhost:3000',
  'http://localhost:3000',
  'http://localhost:5173'
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

module.exports = { corsOptions, whitelist };
