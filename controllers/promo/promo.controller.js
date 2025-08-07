import Promo from '../../models/Promo/Promo.js';

/**
 * Crea una nueva promoción
 * Solo para administradores o miembros con permiso canHandlePromos
 */
export const createPromo = async (req, res, next) => {
    try {
        const { company } = req; // Obtenido del middleware canHandlePromos
        const userId = req.user.id;

        // Si se subió una imagen, agregar la ruta al campo img
        let imagePath = undefined;
        if (req.file) {
            imagePath = `/uploads/companies/${req.file.filename}`;
        }

        const promoData = {
            ...req.body,
            company: company._id,
            createdBy: userId,
            updatedBy: userId,
            ...(imagePath && { img: imagePath })
        };

        const promo = new Promo(promoData);
        await promo.save();

        // Populate para devolver datos completos
        const populatedPromo = await Promo.findById(promo._id)
            .populate('company', 'name')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        return res.status(201).json({
            success: true,
            message: 'Promoción creada exitosamente',
            data: populatedPromo
        });
    } catch (error) {
        console.error('Error al crear promoción:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al crear la promoción',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtiene una promoción por ID
 * Accesible por cualquier miembro de la compañía
 */
export const getPromo = async (req, res, next) => {
    try {
        const { id } = req.params;

        const promo = await Promo.findById(id)
            .populate('company', 'name')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        if (!promo) {
            return res.status(404).json({
                success: false,
                message: 'Promoción no encontrada',
                code: 'PROMO_NOT_FOUND'
            });
        }

        // Verificar que el usuario pertenezca a la compañía de la promoción
        const isMember = await Promo.findOne({
            _id: id,
            'company': req.company._id
        });

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para ver esta promoción',
                code: 'FORBIDDEN'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Promoción obtenida',
            data: promo
        });
    } catch (error) {
        console.error('Error al obtener promoción:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener la promoción',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Actualiza una promoción
 * Solo para administradores o miembros con permiso canHandlePromos
 */
export const updatePromo = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Si se subió una imagen, actualizar el campo img
        let imagePath = undefined;
        if (req.file) {
            imagePath = `/uploads/companies/${req.file.filename}`;
        }

        const updates = {
            ...req.body,
            updatedBy: userId,
            ...(imagePath && { img: imagePath })
        };

        const promo = await Promo.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        )
            .populate('company', 'name')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        if (!promo) {
            return res.status(404).json({
                success: false,
                message: 'Promoción no encontrada',
                code: 'PROMO_NOT_FOUND'
            });
        }

        // Verificar que la promoción pertenezca a la compañía del usuario
        if (promo.company._id.toString() !== req.company._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para actualizar esta promoción',
                code: 'FORBIDDEN'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Promoción actualizada exitosamente',
            data: promo
        });
    } catch (error) {
        console.error('Error al actualizar promoción:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al actualizar la promoción',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Elimina una promoción
 * Solo para administradores o miembros con permiso canHandlePromos
 */
export const deletePromo = async (req, res, next) => {
    try {
        const { id } = req.params;

        const promo = await Promo.findById(id);

        if (!promo) {
            return res.status(404).json({
                success: false,
                message: 'Promoción no encontrada',
                code: 'PROMO_NOT_FOUND'
            });
        }

        // Verificar que la promoción pertenezca a la compañía del usuario
        if (promo.company.toString() !== req.company._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para eliminar esta promoción',
                code: 'FORBIDDEN'
            });
        }

        await Promo.findByIdAndDelete(id);
        return res.status(200).json({
            success: true,
            message: 'Promoción eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar promoción:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al eliminar la promoción',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lista las promociones de una compañía
 * Accesible por cualquier miembro de la compañía
 */
export const listCompanyPromos = async (req, res, next) => {
    try {
        const { company } = req;
        const { page = 1, limit = 10, search = '', active } = req.query;

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            search: search.toString()
        };

        let query = { company: company._id };

        // Filtrar por estado activo si se especifica
        if (active !== undefined) {
            query.active = active === 'true';
        }

        const promos = await Promo.find(query)
            .skip((options.page - 1) * options.limit)
            .limit(options.limit)
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email')
            .sort({ createdAt: -1 });

        // Contar total de promociones para paginación
        const total = await Promo.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: 'Promociones obtenidas',
            data: promos,
            meta: {
                page: options.page,
                limit: options.limit,
                total,
                pages: Math.ceil(total / options.limit)
            }
        });
    } catch (error) {
        console.error('Error al listar promociones:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al listar las promociones',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lista las promociones vigentes de una compañía
 * Accesible por cualquier miembro de la compañía
 */
export const listVigentPromos = async (req, res, next) => {
    try {
        const { company } = req;

        const promos = await Promo.findVigentPromos(company._id);

        return res.status(200).json({
            success: true,
            message: 'Promociones vigentes obtenidas',
            data: promos
        });
    } catch (error) {
        console.error('Error al listar promociones vigentes:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al listar las promociones vigentes',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    createPromo,
    getPromo,
    updatePromo,
    deletePromo,
    listCompanyPromos,
    listVigentPromos
}; 