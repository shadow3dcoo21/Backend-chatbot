/**
 * Controlador para endpoints específicos de N8N
 * Proporciona funciones optimizadas para consultas desde N8N
 */

import Product from '../../models/Product/Product.js';
import Promo from '../../models/Promo/Promo.js';
import Company from '../../models/Company/Company.js';
import Reserva from '../../models/Reserva/Reserva.js';
import getOAuth2Client from '../../config/google.js';
import { google } from 'googleapis';
/**
 * Obtiene productos de una compañía de forma optimizada para N8N
 * Retorna solo los campos necesarios y permite filtrado básico
 */
export const getCompanyProducts = async (req, res) => {
    try {
        
        const { companyId } = req.params;
        console.log('companyId', companyId);
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

/**
 * Crea una reserva en la base de datos y programa un evento en Google Calendar
 */
export const createReservationWithCalendar = async (req, res) => {
    console.log('🔄 Iniciando creación de reserva con Google Calendar');
    
    try {
        const { companyId } = req.params;
        const { firstName, lastName, peopleCount, category, dateTime, duration = 60, description = '' } = req.body;
        
        console.log('📋 Datos recibidos:', { companyId, firstName, lastName, dateTime });

        // Validar datos requeridos
        if (!firstName || !lastName || !peopleCount || !category || !dateTime) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos: firstName, lastName, peopleCount, category, dateTime',
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }

        // Verificar que la compañía existe y tiene tokens de Google
        const company = await Company.findById(companyId);
        if (!company) {
            console.log('❌ Error: Compañía no encontrada:', companyId);
            return res.status(404).json({
                success: false,
                message: 'Compañía no encontrada',
                code: 'COMPANY_NOT_FOUND'
            });
        }

        if (!company.googleAuth || !company.googleAuth.isConnected || !company.googleAuth.accessToken) {
            console.log('❌ Error: Google Calendar no conectado para la compañía:', companyId);
            return res.status(400).json({
                success: false,
                message: 'Google Calendar no está conectado para esta compañía',
                code: 'GOOGLE_CALENDAR_NOT_CONNECTED'
            });
        }

        console.log('✅ Compañía encontrada y Google Calendar conectado');

        // Crear la reserva en la base de datos
        const reservationData = {
            firstName,
            lastName,
            peopleCount,
            category,
            dateTime: new Date(dateTime),
            status: 'confirmado', // Las reservas con calendario se confirman automáticamente
            company: companyId,
            createdBy: req.user?.id || company._id, // Si no hay usuario, usar la compañía
            updatedBy: req.user?.id || company._id
        };

        const reservation = new Reserva(reservationData);
        await reservation.save();
        console.log('✅ Reserva creada en BD:', reservation._id);

        // Configurar cliente OAuth2 con los tokens de la compañía
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({
            access_token: company.googleAuth.accessToken,
            refresh_token: company.googleAuth.refreshToken,
            token_type: company.googleAuth.tokenType,
            expiry_date: company.googleAuth.expiryDate
        });

        // Crear el evento en Google Calendar
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        const startDateTime = new Date(dateTime);
        const endDateTime = new Date(startDateTime.getTime() + (duration * 60000)); // duration en minutos

        const event = {
            summary: `Reserva - ${firstName} ${lastName}`,
            description: `Reserva para ${peopleCount} persona(s)\nCategoría: ${category}\nID de Reserva: ${reservation._id}${description ? `\n\nDescripción: ${description}` : ''}`,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'America/Lima', // Ajustar según tu zona horaria
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'America/Lima',
            },
            attendees: [
                {
                    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`, // Email ficticio o real si se proporciona
                    displayName: `${firstName} ${lastName}`
                }
            ],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 }, // 1 día antes
                    { method: 'popup', minutes: 30 }, // 30 minutos antes
                ],
            },
        };

        console.log('📅 Creando evento en Google Calendar...');
        const calendarResponse = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });

        // Actualizar la reserva con el ID del evento de Google Calendar
        await Reserva.findByIdAndUpdate(reservation._id, {
            $set: {
                googleCalendarEventId: calendarResponse.data.id
            }
        });

        console.log('✅ Evento creado en Google Calendar:', calendarResponse.data.id);

        // Obtener la reserva completa con populate
        const populatedReservation = await Reserva.findById(reservation._id)
            .populate('company', 'name')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        return res.status(201).json({
            success: true,
            message: 'Reserva creada exitosamente y programada en Google Calendar',
            data: {
                reservation: populatedReservation,
                googleCalendarEvent: {
                    id: calendarResponse.data.id,
                    htmlLink: calendarResponse.data.htmlLink,
                    summary: calendarResponse.data.summary,
                    start: calendarResponse.data.start,
                    end: calendarResponse.data.end
                }
            }
        });

    } catch (error) {
        console.error('❌ Error al crear reserva con Google Calendar:', error.message);
        
        // Si hay error después de crear la reserva, intentar eliminarla
        if (error.reservationId) {
            try {
                await Reserva.findByIdAndDelete(error.reservationId);
                console.log('🗑️ Reserva eliminada debido al error en Google Calendar');
            } catch (deleteError) {
                console.error('Error al eliminar reserva:', deleteError);
            }
        }

        return res.status(500).json({
            success: false,
            message: 'Error al crear la reserva con Google Calendar',
            code: 'RESERVATION_CALENDAR_ERROR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};