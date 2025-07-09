const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/Users/User');
const Person = require('../../models/Person/Person');
const crypto = require('crypto');
const permissions = require('../../config/permissions');

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

    // 3️⃣ Si es admin o superadmin, validar accessCode
    if (['admin', 'superadmin'].includes(user.role)) {
      if (!accessCode || accessCode !== user.accessCode) {
        return res.status(400).json({ message: 'Código de acceso inválido o no proporcionado' });
      }
    }

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




//Nuevo
// ================================
// MIDDLEWARES DE AUTORIZACIÓN
// ================================
// middlewares/validateRegistrationPermissions.js
const validateRegistrationPermissions = (req, res, next) => {
  const creatorRole = req.user.role;
  const targetRole  = req.originalUrl.split('/').pop();

  const canCreate = permissions.canCreate;

  if (!canCreate[creatorRole]) {
    return res.status(403).json({ message: 'Rol de usuario no válido para registros' });
  }
  if (!canCreate[creatorRole].includes(targetRole)) {
    return res.status(403).json({
      message: `Tu rol '${creatorRole}' no puede crear usuarios con rol '${targetRole}'.`
    });
  }

  req.targetRole = targetRole;
  next();
};



// Middleware para validar acceso a listado de usuarios
const validateListAccess = (req, res, next) => {
  try {
    const userRole = req.user.role;
    const canList = permissions.canList;

    if (!canList[userRole] || canList[userRole].length === 0) {
      return res.status(403).json({ 
        message: 'No tienes permisos para listar usuarios' 
      });
    }

    req.canListRoles = canList[userRole];
    req.includeOwnProfile = true;
    next();

  } catch (error) {
    console.error('Error en validación de listado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Middleware para validar acceso a usuario específico - Refactorizado
const validateUserAccess = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id; // Usar id en lugar de userId
    const targetUserId = req.params.id;

    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: "ID de usuario inválido" });
    }

    // Verificar si es su propio perfil (siempre permitido)
    if (userId === targetUserId) {
      // req.canAccess = true; // Comentado - usar permisos centralizados
      req.isOwnProfile = true;
      req.allowedAccess = true;
      return next();
    }

    // Obtener permisos de acceso desde configuración centralizada
    const canAccessRoles = permissions.canAccess[userRole] || [];
    
    if (canAccessRoles.length === 0) {
      return res.status(403).json({ 
        message: "No tienes permisos para acceder a otros usuarios" 
      });
    }

    // Verificar el rol del usuario objetivo
    const targetUser = await User.findById(targetUserId).select('role status');
    if (!targetUser) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Validar que el usuario objetivo esté activo
    if (targetUser.status !== 'active') {
      return res.status(404).json({ message: "Usuario no encontrado o inactivo" });
    }

    // Verificar si el rol del usuario objetivo está permitido
    if (!canAccessRoles.includes(targetUser.role)) {
      return res.status(403).json({ 
        message: `No tienes permisos para acceder a usuarios con rol '${targetUser.role}'` 
      });
    }

    // req.canAccess = true; // Comentado - usar permisos centralizados
    req.allowedAccess = true;
    req.targetUserRole = targetUser.role;
    req.targetUserStatus = targetUser.status;
    next();

  } catch (error) {
    console.error('Error en validación de acceso:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Middleware para validar permisos de modificación - Refactorizado
const validateModificationAccess = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id; // Usar id en lugar de userId
    const targetUserId = req.params.id;

    // Verificar si es su propio perfil (siempre permitido para modificar datos básicos)
    if (userId === targetUserId) {
      // req.canModify = true; // Comentado - usar permisos centralizados
      req.isOwnProfile = true;
      req.allowedModify = true;
      return next();
    }

    // Obtener permisos de modificación desde configuración centralizada
    const canModifyRoles = permissions.canModify[userRole] || [];
    
    if (canModifyRoles.length === 0) {
      return res.status(403).json({ 
        message: "No tienes permisos para modificar otros usuarios" 
      });
    }

    // Verificar rol del usuario objetivo
    const targetUser = await User.findById(targetUserId).select('role status');
    if (!targetUser) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Validar que el usuario objetivo esté activo
    if (targetUser.status !== 'active') {
      return res.status(404).json({ message: "Usuario no encontrado o inactivo" });
    }

    // Verificar si el rol del usuario objetivo está permitido para modificación
    if (!canModifyRoles.includes(targetUser.role)) {
      return res.status(403).json({ 
        message: `No tienes permisos para modificar usuarios con rol '${targetUser.role}'` 
      });
    }

    // Validación adicional: admin no puede modificar superadmin
    if (userRole === 'admin' && targetUser.role === 'superadmin') {
      return res.status(403).json({ 
        message: "No puedes modificar usuarios con rol superadmin" 
      });
    }

    // req.canModify = true; // Comentado - usar permisos centralizados
    req.allowedModify = true;
    req.targetUserRole = targetUser.role;
    req.targetUserStatus = targetUser.status;
    next();

  } catch (error) {
    console.error('Error en validación de modificación:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// ================================
// FIN MIDDLEWARES DE AUTORIZACIÓN
// ================================


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

// Función para cambiar estado (activar/desactivar)

const changeStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;
  const userRole = req.user.role;

  try {
    // Validar estado
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Estado no válido' });
    }

    // Validar permisos - solo admin y superadmin pueden cambiar estados
    if (!['admin', 'superadmin'].includes(userRole)) {
      return res.status(403).json({ message: 'No tienes permisos para cambiar estados de usuarios' });
    }

    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'ID de usuario inválido' });
    }

    // Buscar usuario primero para validar que existe
    const user = await User.findById(userId).select('role profileRef status');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Validar que no se cambie el estado de un superadmin por un admin
    if (user.role === 'superadmin' && userRole === 'admin') {
      return res.status(403).json({ message: 'No puedes cambiar el estado de un superadmin' });
    }

    // Iniciar transacción optimizada
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Actualizar estado del User y Person en paralelo
      const [updatedUser] = await Promise.all([
        User.findByIdAndUpdate(
          userId,
          { status },
          { new: true, session }
        ),
        Person.findByIdAndUpdate(
          user.profileRef,
          { status },
          { session }
        )
      ]);

      await session.commitTransaction();
      session.endSession();

      // Log de auditoría
      console.log(`Usuario ${req.user.username} (${userRole}) cambió estado de usuario ${userId} a ${status}`);

      return res.json({ 
        message: 'Estado actualizado correctamente',
        userId: updatedUser._id,
        newStatus: status,
        userRole: updatedUser.role
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    console.error('Error al cambiar estado:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};
// Función para listar usuarios (optimizada)
const getUsers = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id; // Usar id en lugar de userId
    const canListRoles = req.canListRoles || [];

    // Validar permisos usando el middleware previo
    if (!canListRoles || canListRoles.length === 0) {
      return res.status(403).json({ message: 'No tienes permisos para listar usuarios' });
    }

    // Construir filtro optimizado basado en permisos centralizados
    let filter = { role: { $in: canListRoles } };
    
    // Si no es superadmin, incluir su propio perfil
    if (userRole !== 'superadmin') {
      filter = {
        $or: [
          { role: { $in: canListRoles } },
          { _id: userId }
        ]
      };
    }

    // Consulta optimizada con populate y select
    const users = await User.find(filter)
      .select('-password -accessCode')
      .populate({
        path: 'profileRef',
        select: 'firstName lastName email dni age phone sex status'
      })
      .lean()
      .exec();

    // Formatear respuesta de manera más eficiente
    const formattedUsers = users.map(user => {
      const { profileRef, ...userData } = user;
      return {
        ...userData,
        ...profileRef
      };
    });

    // Log de auditoría
    console.log(`Usuario ${req.user.username} (${userRole}) consultó lista de usuarios - ${formattedUsers.length} resultados`);

    return res.status(200).json({
      message: "Usuarios obtenidos exitosamente",
      count: formattedUsers.length,
      users: formattedUsers,
      userRole: userRole,
      accessLevel: userRole === 'superadmin' ? 'full' : 'limited',
      allowedRoles: canListRoles
    });

  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return res.status(500).json({
      message: "Error en el servidor",
      error: error.message
    });
  }
};

// Función para obtener usuario por ID (modificada)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    if (!req.allowedAccess) {
      return res.status(403).json({ message: "No tienes permisos para acceder a este usuario" });
    }

    // Buscar usuario
    const user = await User.findById(id)
      .select('-password')
      .populate({
        path: 'profileRef',
        select: '-userRef -_id -createdAt -updatedAt -__v'
      })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Formatear respuesta
    const formattedUser = {
      ...user,
      ...user.profileRef
    };
    delete formattedUser.profileRef;

    // Log de auditoría
    console.log(`Usuario ${req.user.username} (${userRole}) consultó perfil de usuario ID: ${id}`);

    return res.status(200).json({
      message: "Usuario obtenido exitosamente",
      user: formattedUser,
      isOwnProfile: req.isOwnProfile || false
    });

  } catch (error) {
    console.error("Error al obtener usuario:", error);
    return res.status(500).json({
      message: "Error en el servidor",
      error: error.message
    });
  }
};

// Función para actualizar usuario (optimizada)
const updateUser = async (req, res) => {
  const { id } = req.params;
  let userData = {};
  let personData = {};

  try {
    if (!req.allowedModify) {
      return res.status(403).json({ message: "No tienes permisos para modificar este usuario" });
    }

    // Buscar usuario existente
    const existingUser = await User.findById(id)
      .populate('profileRef')
      .lean();
      
    if (!existingUser || !existingUser.profileRef) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Validaciones adicionales para cambios sensibles
    const { username, password, role, status, ...rest } = req.body;
    
    // Solo superadmin y admin pueden cambiar rol y status
    if ((role || status) && !['superadmin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Solo los administradores pueden cambiar rol o status" 
      });
    }

    // Validar rol si se está cambiando
    if (role && !['superadmin', 'admin', 'general'].includes(role)) {
      return res.status(400).json({ message: "Rol no válido" });
    }

    // Validar que admin no pueda cambiar a superadmin
    if (role === 'superadmin' && req.user.role === 'admin') {
      return res.status(403).json({ 
        message: "No puedes asignar rol superadmin" 
      });
    }

    // Preparar datos para actualización
    if (username) userData.username = username;
    if (password) userData.password = await bcrypt.hash(password, 10);
    if (role && ['superadmin', 'admin'].includes(req.user.role)) userData.role = role;
    if (status && ['superadmin', 'admin'].includes(req.user.role)) userData.status = status;

    personData = rest;

    // Validaciones de unicidad
    if (username) {
      const userExists = await User.findOne({ username, _id: { $ne: id } });
      if (userExists) return res.status(400).json({ message: "Nombre de usuario en uso" });
    }

    if (personData.email) {
      const emailExists = await Person.findOne({ 
        email: personData.email, 
        _id: { $ne: existingUser.profileRef._id } 
      });
      if (emailExists) return res.status(400).json({ message: "Email ya registrado" });
    }

    if (personData.dni) {
      const dniExists = await Person.findOne({ 
        dni: personData.dni, 
        _id: { $ne: existingUser.profileRef._id } 
      });
      if (dniExists) return res.status(400).json({ message: "DNI ya registrado" });
    }

    // Actualizar documentos
    const updateOperations = [];
    
    if (Object.keys(userData).length > 0) {
      userData.lastModifiedBy = req.user.id;
      userData.lastModifiedAt = new Date();
      updateOperations.push(
        User.findByIdAndUpdate(id, { $set: userData }, { new: true })
      );
    }
    
    if (Object.keys(personData).length > 0) {
      personData.lastModifiedBy = req.user.id;
      personData.lastModifiedAt = new Date();
      updateOperations.push(
        Person.findByIdAndUpdate(
          existingUser.profileRef._id,
          { $set: personData },
          { new: true }
        )
      );
    }

    await Promise.all(updateOperations);

    // Obtener resultado final
    const finalUser = await User.findById(id)
      .select('-password')
      .populate({
        path: 'profileRef',
        select: 'firstName lastName email dni age phone sex status'
      })
      .lean();

    const formattedUser = {
      ...finalUser,
      ...finalUser.profileRef
    };
    delete formattedUser.profileRef;

    // Log de auditoría
    console.log(`Usuario ${req.user.username} (${req.user.role}) actualizó usuario ID: ${id}`);

    return res.status(200).json({
      message: "Usuario actualizado exitosamente",
      user: formattedUser,
      modifiedBy: req.user.username,
      userRole: req.user.role
    });

  } catch (error) {
    console.error("Error en actualización:", error);
    return res.status(500).json({
      message: "Error en el servidor",
      error: error.message
    });
  }
};

// Función para eliminar usuario (modificada)
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    if (!req.allowedModify) {
      return res.status(403).json({ message: "No tienes permisos para eliminar este usuario" });
    }

    // Buscar usuario
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Validación adicional: no permitir que se eliminen a sí mismos los no-admin
    if (req.user.userId === id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: "No puedes eliminar tu propia cuenta. Contacta a un administrador." 
      });
    }

    // Eliminar perfil primero
    const deletedPerson = await Person.findOneAndDelete({ userRef: id });
    
    // Eliminar usuario
    const deletedUser = await User.findByIdAndDelete(id);

    // Verificar eliminación completa
    if (!deletedPerson || !deletedUser) {
      if (deletedPerson && !deletedUser) {
        await Person.create(deletedPerson);
      }
      return res.status(500).json({ message: "Error al eliminar los registros" });
    }

    // Log de auditoría
    console.log(`Usuario ${req.user.username} (${req.user.role}) eliminó usuario ID: ${id}`);

    return res.status(200).json({
      message: "Usuario y perfil eliminados exitosamente",
      deletedUserId: id,
      deletedBy: req.user.username
    });

  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return res.status(500).json({
      message: "Error en el servidor",
      error: error.message
    });
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

// Función para obtener perfil propio (nueva - recomendada para estudiantes y externos)
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId)
      .select('-password')
      .populate({
        path: 'profileRef',
        select: '-userRef -_id -createdAt -updatedAt -__v'
      })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Perfil no encontrado" });
    }

    const formattedUser = {
      ...user,
      ...user.profileRef
    };
    delete formattedUser.profileRef;

    return res.status(200).json({
      message: "Perfil obtenido exitosamente",
      user: formattedUser
    });

  } catch (error) {
    console.error("Error al obtener perfil:", error);
    return res.status(500).json({
      message: "Error en el servidor",
      error: error.message
    });
  }
};

module.exports = { 
  validateRegistrationPermissions,
  validateListAccess,
  validateUserAccess,
  validateModificationAccess,
  getUserPermissions,
  changePassword ,
  deleteUser,
  updateUser,
  getUserById,
  getUsers,
  loginUser, 
  registerUser,
  changeStatus,
  getMyProfile
};