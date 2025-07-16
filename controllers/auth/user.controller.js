import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../models/Users/User.js';
import Person from '../../models/Person/Person.js';
import crypto from 'crypto';
import permissions from '../../config/permissions.js';
import Company from '../../models/Company/Company.js';

const changeStatus = async (req, res) => {
  const { id } = req.params;
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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de usuario inválido' });
    }

    // Buscar usuario primero para validar que existe
    const user = await User.findById(id).select('role profileRef status');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Validar que no se cambie el estado de un superadmin por un admin
    if (user.role === 'superadmin' && userRole === 'admin') {
      return res.status(403).json({ message: 'No puedes cambiar el estado de un superadmin' });
    }

    // Actualizar ambos documentos sin transacción
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    await Person.findByIdAndUpdate(
      user.profileRef,
      { status }
    );

    // Log de auditoría
    console.log(`Usuario ${req.user.username} (${userRole}) cambió estado de usuario ${id} a ${status}`);

    return res.json({
      message: 'Estado actualizado correctamente',
      userId: updatedUser._id,
      newStatus: status,
      userRole: updatedUser.role
    });

  } catch (error) {
    console.error('Error al cambiar estado:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};

const getUsers = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id; // Usar id en lugar de userId
    const canListRoles = req.canListRoles || [];

    // Validar permisos usando el middleware previo
    if (!canListRoles || canListRoles.length === 0) {
      return res.status(403).json({ message: 'No tienes permisos para listar usuarios' });
    }

    // Construir filtro optimizado basado en permisos centralizados y empresa
    let filter = { role: { $in: canListRoles } };

    // Si no es superadmin, incluir su propio perfil
    if (userRole !== 'superadmin') {
      filter = {
        $or: [
          { role: { $in: canListRoles }, ...(req.companyFilter || {}) },
          { _id: userId }
        ]
      };
    } else if (req.companyFilter) {
      // Por si algún día superadmin tiene filtro de empresa
      filter = { ...filter, ...req.companyFilter };
    }

    // Consulta optimizada con populate y select
    const users = await User.find(filter)
      .select('-password -accessCode')
      .populate({
        path: 'profileRef',
        select: 'firstName lastName email dni age phone sex status'
      })
      .populate('companyRef')
      .lean()
      .exec();

    // Formatear respuesta de manera más eficiente
    const formattedUsers = users.map(user => {
      const { profileRef, companyRef, ...userData } = user;
      return {
        ...userData,
        ...profileRef,
        ...(companyRef && {
          company: {
            id: companyRef._id,
            name: companyRef.name,
          }
        })
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
    console.log("usuario id", id);
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
      .populate('companyRef')
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Formatear respuesta
    const { profileRef, companyRef, ...userData } = user;
    const formattedUser = {
      ...userData,
      ...profileRef,
      ...(companyRef && {
        company: {
          id: companyRef._id,
          name: companyRef.name,
        }
      })
    };

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

// Función para actualizar usuario 
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
      .populate('companyRef')
      .lean();

    const { profileRef, companyRef, ...userData } = finalUser;
    const formattedUser = {
      ...userData,
      ...profileRef,
      ...(companyRef && {
        company: {
          id: companyRef._id,
          name: companyRef.name,
        }
      })
    };

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

// Función para eliminar usuario
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

// Función para obtener perfil propio (nueva - recomendada para estudiantes y externos)
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const user = await User.findById(userId)
      .select('-password')
      .populate({
        path: 'profileRef',
        select: '-userRef -_id -createdAt -updatedAt -__v'
      })
      .populate('companyRef')
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Perfil no encontrado" });
    }

    const { profileRef, companyRef, ...userData } = user;
    const formattedUser = {
      ...userData,
      ...profileRef,
      ...(companyRef && {
        company: {
          id: companyRef._id,
          name: companyRef.name,
        }
      })
    };

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

// Obtener usuario a partir del id de Person
const getUserByPersonId = async (req, res) => {
  try {
    const { id } = req.params; // id de Person
    console.log("person id", id);
    const userRole = req.user.role;

    // Permisos: puedes agregar lógica similar a req.allowedAccess si aplica
    // if (!req.allowedAccess) {
    //   return res.status(403).json({ message: "No tienes permisos para acceder a este usuario" });
    // }

    // Buscar Person
    const person = await Person.findById(id).lean();
    if (!person) {
      return res.status(404).json({ message: "Persona no encontrada" });
    }

    // Buscar User asociado
    const user = await User.findById(person.userRef)
      .select('-password')
      .populate({
        path: 'profileRef',
        select: '-userRef -_id -createdAt -updatedAt -__v'
      })
      .populate('companyRef')
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado para esta persona" });
    }

    // Formatear respuesta
    const { profileRef, companyRef, ...userData } = user;
    const formattedUser = {
      ...userData,
      ...profileRef,
      ...(companyRef && {
        company: {
          id: companyRef._id,
          name: companyRef.name,
        }
      })
    };

    // Log de auditoría
    console.log(`Usuario ${req.user.username} (${userRole}) consultó perfil de usuario por Person ID: ${id}`);

    return res.status(200).json({
      message: "Usuario obtenido exitosamente",
      user: formattedUser,
      isOwnProfile: req.isOwnProfile || false
    });

  } catch (error) {
    console.error("Error al obtener usuario por PersonId:", error);
    return res.status(500).json({
      message: "Error en el servidor",
      error: error.message
    });
  }
};

export {
  changeStatus,
  deleteUser,
  getMyProfile,
  getUserById,
  getUsers,
  updateUser,
  getUserByPersonId,
};