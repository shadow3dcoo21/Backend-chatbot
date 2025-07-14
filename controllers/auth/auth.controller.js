import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../models/Users/User.js';
import Person from '../../models/Person/Person.js';
import crypto from 'crypto';
import permissions from '../../config/permissions.js';

// Función para loguearse (para 4 roles: alumno, profesor, externo y admin)


// POST /login
const loginUser = async (req, res) => {
  const { username, password, accessCode } = req.body;

  try {
    // 1️⃣ Buscar usuario activo
    const user = await User.findOne({ username, status: 'active' }).populate('profileRef');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado o cuenta inactiva' });
    }

    // 2️⃣ Validar contraseña siempre
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Usuario o contraseña incorrectos' });
    }
    /*
    // 3️⃣ Si es admin o superadmin, validar accessCode
    if (['admin', 'superadmin'].includes(user.role)) {
      if (!accessCode || accessCode !== user.accessCode) {
        return res.status(400).json({ message: 'Código de acceso inválido o no proporcionado' });
      }
    }
    */
   
    // 4️⃣ Crear payload para JWT
    const payload = {
      id: user._id,
      username: user.username,
      role: user.role,
      status: user.status,
      ...(user.profileRef && {
        profile: {
          firstName: user.profileRef.firstName,
          lastName: user.profileRef.lastName,
          email: user.profileRef.email,
        }
      })
    };

    // 5️⃣ Firmar JWT
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    // 6️⃣ Responder
    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        ...(user.profileRef && {
          firstName: user.profileRef.firstName,
          lastName: user.profileRef.lastName,
        })
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};


// Función para registrar un nuevo usuario (mejorada)
// Genera un accessCode único de 32 caracteres (incluye especiales)
function generateAccessCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?';
  let result = '';
  const used = new Set();
  while (result.length < 32) {
    const idx = crypto.randomInt(0, chars.length);
    const c = chars[idx];
    if (!used.has(c)) {
      used.add(c);
      result += c;
    }
  }
  return result;
}

const registerUser = async (req, res) => {
  const {
    role,           // role viene en el JSON
    username,
    password,
    firstName,
    lastName,
    sex,
    email,
    dni,
    age,
    phone
  } = req.body;

  let newUser, newPerson;

  try {
    // 1️⃣ Validar rol
    if (!['superadmin','admin','general'].includes(role)) {
      return res.status(400).json({ message: 'Rol no válido' });
    }

    // 2️⃣ Campos básicos obligatorios
    if (!username || !password || !firstName || !lastName ||
        !sex || !email || !dni || !age || !phone) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    // 3️⃣ Unicidad
    const [uExists, eExists, dExists] = await Promise.all([
      User.findOne({ username }),
      Person.findOne({ email }),
      Person.findOne({ dni })
    ]);
    if (uExists) return res.status(400).json({ message: 'Username ya en uso' });
    if (eExists) return res.status(400).json({ message: 'Email ya registrado' });
    if (dExists) return res.status(400).json({ message: 'DNI ya registrado' });

    // 4️⃣ Hashear contraseña
    const hashed = await bcrypt.hash(password, 10);

    // 5️⃣ Generar accessCode si aplica
    let accessCode;
    if (['admin','superadmin'].includes(role)) {
      accessCode = generateAccessCode();
    }

    // 6️⃣ Crear User
    newUser = await User.create({
      username,
      password:   hashed,
      role,
      status:     'active',
      accessCode,          // undefined para 'general'
      createdBy:  null
    });

    // 7️⃣ Crear Person
    newPerson = await Person.create({
      firstName,
      lastName,
      sex,
      email,
      dni,
      age,
      phone,
      associatedRole: role,
      userRef:        newUser._id,
      status:         'active',
      createdBy:      null
    });

    // 8️⃣ Vincular perfil
    newUser.profileRef = newPerson._id;
    await newUser.save();

    // 9️⃣ Respuesta: incluimos el accessCode generado
    return res.status(201).json({
      message:    'Usuario registrado exitosamente',
      userId:     newUser._id,
      personId:   newPerson._id,
      role:       newUser.role,
      accessCode: newUser.accessCode  // sólo para admin/superadmin
    });

  } catch (err) {
    console.error('Error en registro:', err);
    if (newUser)   await User.deleteOne({ _id: newUser._id });
    if (newPerson) await Person.deleteOne({ _id: newPerson._id });
    return res.status(500).json({ message: 'Error interno del servidor', error: err.message });
  }
};

// Función adicional para obtener permisos de un usuario (opcional)
const getUserPermissions = (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Token de autenticación requerido' });
    }

    const canRegister = permissions.canCreate[req.user.role] || [];

    return res.json({
      userRole: req.user.role,
      canRegister,
      message: canRegister.length > 0 
        ? `Puedes registrar: ${canRegister.join(', ')}`
        : 'No tienes permisos para registrar usuarios'
    });

  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Función para cambiar contraseña (modificada)
const changePassword = async (req, res) => {
  const { id } = req.params;
  const { oldPassword, newPassword, confirmNewPassword } = req.body;

  try {
    if (!req.allowedModify) {
      return res.status(403).json({ message: "No tienes permisos para cambiar la contraseña de este usuario" });
    }

    // Buscar usuario
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Validar campos obligatorios
    if (!newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: "Nueva contraseña y confirmación son requeridas" });
    }

    // Si no es admin y no es su propio perfil, requerir contraseña actual
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({ message: "No autorizado para cambiar esta contraseña" });
    }

    // Si es su propio perfil (no admin), validar contraseña actual
    if (req.user.userId === id && req.user.role !== 'admin') {
      if (!oldPassword) {
        return res.status(400).json({ message: "Contraseña actual es requerida" });
      }
      
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Contraseña actual incorrecta" });
      }
    }

    // Validar coincidencia de nuevas contraseñas
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Las nuevas contraseñas no coinciden" });
    }

    // Validar fortaleza de contraseña
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: "La nueva contraseña debe contener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial"
      });
    }

    // Actualizar contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.lastModifiedBy = req.user.userId;
    user.lastModifiedAt = new Date();
    await user.save();

    // Log de auditoría
    console.log(`Usuario ${req.user.username} (${req.user.role}) cambió contraseña de usuario ID: ${id}`);

    return res.status(200).json({
      message: "Contraseña actualizada exitosamente",
      userId: user._id,
      changedBy: req.user.username,
      updatedAt: user.lastModifiedAt
    });

  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    return res.status(500).json({
      message: "Error en el servidor",
      error: error.message
    });
  }
};

export { 
  getUserPermissions,
  changePassword ,
  loginUser, 
  registerUser,
};