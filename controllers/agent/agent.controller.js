/**
 * Controlador para endpoints específicos de N8N
 * Proporciona funciones optimizadas para consultas desde N8N
 */

import Product from '../../models/Product/Product.js';
import Promo from '../../models/Promo/Promo.js';
import Company from '../../models/Company/Company.js';
import Reserva from '../../models/Reserva/Reserva.js';

/**
 * Obtiene productos de una compañía de forma optimizada para N8N
 * Retorna solo los campos necesarios y permite filtrado básico
 */
export const getCompanyProducts = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { limit = 5, inStock } = req.query;

        // Construir query base
        const query = { company: companyId };

        // Filtrar solo productos en stock si se especifica
        if (inStock === 'true') {
            query.stock = true;
        }

        // Proyección para incluir solo campos necesarios
        const projection = {
            name: 1,
            price: 1,
            description: 1,
            stock: 1,
            image: 1,
            subProducts: 1,
        };

        // Ejecutar consulta optimizada
        const products = await Product.find(query, projection)
            .limit(parseInt(limit))
            .lean(); // Usar lean() para respuestas más rápidas y ligeras

        // Respuesta compacta
        return res.json(products);
    } catch (error) {
        console.error('Error al obtener productos para N8N:', error);
        return res.status(500).json({
            error: 'Error al obtener productos',
            message: error.message
        });
    }
};

/**
 * Obtiene promociones activas de una compañía de forma optimizada para N8N
 */
export const getActivePromos = async (req, res) => {
    try {
        const { companyId } = req.params;
        const now = new Date();
        const currentHour = now.getHours();

        // Consulta optimizada para promociones activas
        const activePromos = await Promo.find({
            company: companyId,
            active: true,
            'periodo.startDate': { $lte: now },
            'periodo.endDate': { $gte: now },
            'periodo_hour.startHour': { $lte: currentHour },
            'periodo_hour.endHour': { $gte: currentHour }
        }, {
            name: 1,
            description: 1,
            price: 1,
            img: 1
        }).lean();

        return res.json(activePromos);
    } catch (error) {
        console.error('Error al obtener promociones para N8N:', error);
        return res.status(500).json({
            error: 'Error al obtener promociones',
            message: error.message
        });
    }
};

/**
 * Obtiene información básica de una compañía
 */
export const getCompanyInfo = async (req, res) => {
    try {
        const { companyId } = req.params;

        const company = await Company.findById(companyId, {
            name: 1,
            sector: 1,
            email: 1,
            phone: 1,
            address: 1,
            location: 1,
            image: 1
        }).lean();

        if (!company) {
            return res.status(404).json({
                error: 'Compañía no encontrada'
            });
        }

        return res.json(company);
    } catch (error) {
        console.error('Error al obtener información de compañía para N8N:', error);
        return res.status(500).json({
            error: 'Error al obtener información de compañía',
            message: error.message
        });
    }
};

/**
 * Obtiene reservas de una compañía de forma optimizada para N8N
 * Permite filtrar por estado y fecha
 */
export const getCompanyReservations = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { status, date, limit = 10 } = req.query;

        // Construir query base
        const query = { company: companyId };

        // Filtrar por estado si se especifica
        if (status && ['pendiente', 'confirmado', 'cancelado'].includes(status)) {
            query.status = status;
        }

        // Filtrar por fecha si se especifica
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);

            query.dateTime = {
                $gte: startDate,
                $lte: endDate
            };
        }

        // Proyección para incluir solo campos necesarios
        const projection = {
            firstName: 1,
            lastName: 1,
            peopleCount: 1,
            category: 1,
            dateTime: 1,
            status: 1
        };

        // Ejecutar consulta optimizada
        const reservations = await Reserva.find(query, projection)
            .sort({ dateTime: 1 })
            .limit(parseInt(limit))
            .lean(); // Usar lean() para respuestas más rápidas y ligeras

        // Respuesta compacta
        return res.json(reservations);
    } catch (error) {
        console.error('Error al obtener reservas para N8N:', error);
        return res.status(500).json({
            error: 'Error al obtener reservas',
            message: error.message
        });
    }
};