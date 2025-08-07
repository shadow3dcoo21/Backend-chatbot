import Reservation from '../../models/Reserva/Reserva.js';

/**
 * Crea una nueva reserva
 * Solo para administradores o miembros con permiso canHandleReservas
 */
export const createReservation = async (req, res, next) => {
    try {
        const { company } = req;
        const userId = req.user.id;

        const reservationData = {
            ...req.body,
            company: company._id,
            createdBy: userId,
            updatedBy: userId,
            status: 'pendiente' // Por defecto las reservas se crean como pendientes
        };

        const reservation = new Reservation(reservationData);
        await reservation.save();

        const populatedReservation = await Reservation.findById(reservation._id)
            .populate('company', 'name')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        return res.status(201).json({
            success: true,
            message: 'Reserva creada exitosamente',
            data: populatedReservation
        });
    } catch (error) {
        console.error('Error al crear reserva:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al crear la reserva',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtiene una reserva por ID
 * Accesible por cualquier miembro de la compañía
 */
export const getReservation = async (req, res, next) => {
    try {
        const { id } = req.params;

        const reservation = await Reservation.findById(id)
            .populate('company', 'name')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada',
                code: 'RESERVATION_NOT_FOUND'
            });
        }

        // Verificar que la reserva pertenezca a la compañía del usuario
        if (reservation.company._id.toString() !== req.company._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para ver esta reserva',
                code: 'FORBIDDEN'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Reserva obtenida',
            data: reservation
        });
    } catch (error) {
        console.error('Error al obtener reserva:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener la reserva',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Actualiza una reserva
 * Solo para administradores o miembros con permiso canHandleReservas
 */
export const updateReservation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const updates = {
            ...req.body,
            updatedBy: userId
        };

        const reservation = await Reservation.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        )
            .populate('company', 'name')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada',
                code: 'RESERVATION_NOT_FOUND'
            });
        }

        // Verificar que la reserva pertenezca a la compañía del usuario
        if (reservation.company._id.toString() !== req.company._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para actualizar esta reserva',
                code: 'FORBIDDEN'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Reserva actualizada exitosamente',
            data: reservation
        });
    } catch (error) {
        console.error('Error al actualizar reserva:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al actualizar la reserva',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Elimina una reserva
 * Solo para administradores o miembros con permiso canHandleReservas
 */
export const deleteReservation = async (req, res, next) => {
    try {
        const { id } = req.params;

        const reservation = await Reservation.findById(id);

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada',
                code: 'RESERVATION_NOT_FOUND'
            });
        }

        // Verificar que la reserva pertenezca a la compañía del usuario
        if (reservation.company.toString() !== req.company._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para eliminar esta reserva',
                code: 'FORBIDDEN'
            });
        }

        await Reservation.findByIdAndDelete(id);
        return res.status(200).json({
            success: true,
            message: 'Reserva eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar reserva:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al eliminar la reserva',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lista todas las reservas de una compañía
 * Accesible por cualquier miembro de la compañía
 */
export const listCompanyReservations = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const skip = (page - 1) * limit;

        const query = { company: req.company._id };
        
        // Filtrar por estado si se especifica
        if (status && ['pendiente', 'confirmado', 'cancelado'].includes(status)) {
            query.status = status;
        }

        const [reservations, total] = await Promise.all([
            Reservation.find(query)
                .sort({ dateTime: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('createdBy', 'username email')
                .populate('updatedBy', 'username email'),
            Reservation.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            message: 'Reservas obtenidas',
            data: reservations,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error al listar reservas:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al listar las reservas',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtiene el conteo de reservas por estado
 * Accesible por cualquier miembro de la compañía
 */
export const getReservationsCountByStatus = async (req, res, next) => {
    try {
        const companyId = req.company._id;

        const [pending, confirmed, cancelled] = await Promise.all([
            Reservation.countDocuments({ company: companyId, status: 'pendiente' }),
            Reservation.countDocuments({ company: companyId, status: 'confirmado' }),
            Reservation.countDocuments({ company: companyId, status: 'cancelado' })
        ]);

        return res.status(200).json({
            success: true,
            message: 'Conteo de reservas obtenido',
            data: {
                pending,
                confirmed,
                cancelled,
                total: pending + confirmed + cancelled
            }
        });
    } catch (error) {
        console.error('Error al obtener conteo de reservas:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener el conteo de reservas',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    createReservation,
    getReservation,
    updateReservation,
    deleteReservation,
    listCompanyReservations,
    getReservationsCountByStatus
};
