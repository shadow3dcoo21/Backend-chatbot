import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Acceso no autorizado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Guardar los datos importantes del usuario en req.user
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      profile: decoded.profile,
      status: decoded.status
    };

    next();
  } catch (error) {
    return res.status(400).json({ message: 'Token no válido o expirado' });
  }
};

export default authMiddleware;
