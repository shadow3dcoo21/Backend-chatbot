import Company from '../../models/Company/Company.js';
import User from '../../models/Users/User.js';
import Product from '../../models/Product/Product.js';
import Promo from '../../models/Promo/Promo.js';
import { checkCompanyPermission } from '../../middlewares/permissionMiddleware.js';
import { 
  getImageUrl, 
  deleteLocalImage, 
  isValidLocalImageUrl, 
  extractFilenameFromUrl 
} from '../../util/localImageUpload.js';

// Crear una nueva compañía
export const createCompany = async (req, res) => {

  try {
    const {
      name,
      sector,
      email,
      phone,
      address,
      location,
      employeeCount = 0
    } = req.body;
    const userId = req.user.id;
    
    // Manejar imagen si se subió un archivo
    let imageUrl = '';
    if (req.file) {
      // Generar URL local para la imagen
      imageUrl = getImageUrl(req.file.filename);
    }
    
    // Si no hay archivo, usar imagen del body o string vacío
    const image = req.body.image || imageUrl || '';

    // Verificar si el usuario ya es dueño de otra compañía
    const existingCompany = await Company.findOne({
      'members.userId': userId,
      'members.role': 'owner',
      'members.status': 'active'
    });

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        error: 'Ya eres dueño de otra compañía',
        code: 'COMPANY_OWNERSHIP_CONFLICT'
      });
    }

    // Crear la nueva compañía con el usuario como dueño
    const company = new Company({
      name: name.trim(),
      image,
      sector,
      email,
      phone,
      address,
      location,
      employeeCount,
      members: [{
        userId,
        role: 'owner',
        status: 'active',
        invitedAt: new Date(),
        invitedBy: userId,
        permissions: {
          canInvite: true,
          canManageMembers: true,
          canEditCompany: true,
          canDeleteCompany: true
        }
      }]
    });

    await company.save();

    // Populate para devolver datos completos
    const populatedCompany = await Company.findById(company._id)
      .populate('members.userId', 'username email')
      .populate('members.invitedBy', 'username');

    // Actualizar el perfil del usuario con la referencia a la compañía
    await User.findByIdAndUpdate(userId, {
      $addToSet: { companies: company._id }
    });

    return res.status(201).json({
      success: true,
      message: 'Compañía creada exitosamente',
      data: populatedCompany
    });
  } catch (error) {
    console.error('Error al crear compañía:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al crear la compañía',
      code: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Obtener compañía por ID
export const getCompany = [
  checkCompanyPermission(),
  async (req, res) => {
    try {
      const company = await Company.findById(req.params.id)
        .populate('members.userId', 'username email profile')
        .populate('members.invitedBy', 'username')
        .lean();

      if (!company) {
        return res.status(404).json({
          success: false,
          error: 'Compañía no encontrada',
          code: 'COMPANY_NOT_FOUND'
        });
      }

      // Filtrar información sensible basada en el rol del usuario
      const currentMember = company.members.find(member =>
        member.userId && member.userId._id.toString() === req.user.id
      );

      const isAdmin = currentMember && ['owner', 'admin'].includes(currentMember.role);

      // Si no es admin, filtrar información sensible
      if (!isAdmin) {
        company.members = company.members
          .filter(member => member.status === 'active')
          .map(member => ({
            userId: member.userId,
            role: member.role,
            status: member.status,
            joinedAt: member.joinedAt
          }));
      }

      return res.json({
        success: true,
        data: company
      });
    } catch (error) {
      console.error('Error al obtener compañía:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al obtener la compañía',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
];

// Actualizar compañía
export const updateCompany = [
  checkCompanyPermission(['owner', 'admin']),
  async (req, res) => {

    try {
      const {
        name,
        sector,
        email,
        phone,
        address,
        location,
        employeeCount
      } = req.body;

      const updates = {};

      // Solo permitir actualizar campos permitidos
      if (name) updates.name = name.trim();
      if (sector !== undefined) updates.sector = sector;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (address !== undefined) updates.address = address;
      if (location !== undefined) updates.location = location;
      if (employeeCount !== undefined) updates.employeeCount = employeeCount;

      // Obtener la compañía actual para manejar la imagen
      const currentCompany = await Company.findById(req.params.id);
      if (!currentCompany) {
        return res.status(404).json({
          success: false,
          error: 'Compañía no encontrada',
          code: 'COMPANY_NOT_FOUND'
        });
      }

             // Manejar imagen si se subió un archivo
       if (req.file) {
         try {
           // Eliminar imagen anterior si existe
           if (currentCompany.image && isValidLocalImageUrl(currentCompany.image)) {
             const oldFilename = extractFilenameFromUrl(currentCompany.image);
             await deleteLocalImage(oldFilename);
           }
           
           // Generar URL para la nueva imagen
           const imageUrl = getImageUrl(req.file.filename);
           updates.image = imageUrl;
         } catch (uploadError) {
           console.error('Error al procesar imagen:', uploadError);
           return res.status(500).json({
             success: false,
             error: 'Error al procesar la imagen',
             code: 'IMAGE_UPLOAD_ERROR',
             details: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
           });
         }
       } else if (req.body.image !== undefined) {
         // Si se proporciona una URL de imagen en el body
         updates.image = req.body.image;
       }

      const company = await Company.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true }
      )
        .populate('members.userId', 'username email')
        .populate('members.invitedBy', 'username');

      return res.json({
        success: true,
        message: 'Compañía actualizada exitosamente',
        data: company
      });
    } catch (error) {
      console.error('Error al actualizar compañía:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al actualizar la compañía',
        code: 'INTERNAL_SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];

// Eliminar compañía
export const deleteCompany = [
  checkCompanyPermission(['owner']),
  async (req, res) => {
    try {
      const companyId = req.params.id;
      const userId = req.user.id;

      // Verificar si la compañía tiene miembros activos
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: 'Compañía no encontrada',
          code: 'COMPANY_NOT_FOUND'
        });
      }

      // Verificar que el usuario sea el propietario
      const isOwner = company.members.some(
        m => m.userId.toString() === userId &&
          m.role === 'owner' &&
          m.status === 'active'
      );

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: 'Solo el propietario puede eliminar la compañía',
          code: 'FORBIDDEN'
        });
      }

             // Eliminar imagen de la compañía si existe
       if (company.image && isValidLocalImageUrl(company.image)) {
         const filename = extractFilenameFromUrl(company.image);
         await deleteLocalImage(filename);
       }

       // Eliminar todos los productos asociados a la compañía
       const deletedProducts = await Product.deleteMany({ company: companyId });
       console.log(`🗑️ Eliminados ${deletedProducts.deletedCount} productos de la compañía ${companyId}`);

       // Eliminar todas las promociones asociadas a la compañía
       const deletedPromos = await Promo.deleteMany({ company: companyId });
       console.log(`🗑️ Eliminadas ${deletedPromos.deletedCount} promociones de la compañía ${companyId}`);

       // Eliminar la compañía
       await Company.findByIdAndDelete(companyId);

       // Actualizar referencias en los usuarios
       await User.updateMany(
         { 'companies': companyId },
         { $pull: { companies: companyId } }
       );

      return res.json({
        success: true,
        message: 'Compañía eliminada exitosamente',
        data: { companyId }
      });
    } catch (error) {
      console.error('Error al eliminar compañía:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al eliminar la compañía',
        code: 'INTERNAL_SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];

// Listar compañías del usuario actual
export const listMyCompanies = async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener todas las compañías donde el usuario es miembro activo
    const companies = await Company.find({
      'members.userId': userId,
      'members.status': 'active'
    })
      .select('name image sector email phone address location employeeCount members.role members.status')
      .populate({
        path: 'members.userId',
        match: { _id: userId },
        select: 'username email'
      })
      .lean();

    // Formatear la respuesta
    const formattedCompanies = companies.map(company => {
      // Encontrar la membresía del usuario actual
      const userMembership = company.members.find(member =>
        member.userId && member.userId._id.toString() === userId
      );

      return {
        _id: company._id,
        name: company.name,
        sector: company.sector,
        email: company.email,
        phone: company.phone,
        address: company.address,
        location: company.location,
        employeeCount: company.employeeCount,
        image: company.image,
        role: userMembership?.role,
        status: userMembership?.status,
        joinedAt: userMembership?.joinedAt,
        //memberCount: company.members.length,
        //createdAt: company.createdAt,
        //updatedAt: company.updatedAt
      };
    });

    return res.json({
      success: true,
      data: formattedCompanies,
      meta: {
        total: formattedCompanies.length
      }
    });
  } catch (error) {
    console.error('Error al listar compañías:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al listar las compañías',
      code: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};