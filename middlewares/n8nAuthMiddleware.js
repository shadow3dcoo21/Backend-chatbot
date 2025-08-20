/**
 * Middleware para autenticación de N8N mediante API key
 * Proporciona una forma simple de autenticación para las solicitudes provenientes de N8N
 */

const n8nAuthMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  console.log('API Key recibida:', apiKey);
  // Verificar que la API key esté presente y sea válida
  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return res.status(401).json({ 
      success: false, 
      error: 'Acceso no autorizado. API key inválida o no proporcionada.' 
    });
  }
  
  // Si la autenticación es exitosa, continuar
  next();
};

export default n8nAuthMiddleware;