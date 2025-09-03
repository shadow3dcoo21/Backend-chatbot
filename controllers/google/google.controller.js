/**
 * Controlador para la integración con Google Calendar API
 * Maneja la autenticación OAuth2 y el acceso a los recursos de calendario
 */

import { google } from 'googleapis';
import Company from '../../models/Company/Company.js';
import Reservation from '../../models/Reserva/Reserva.js';

// Función para obtener el cliente OAuth2 (inicialización diferida)
const getOAuth2Client = () => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben estar configurados en las variables de entorno');
    }
    
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.BASE_URL || 'http://localhost:3000'}/api/google/callback`
    );
};

// Scopes necesarios para Google Calendar
const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
];

export const getAuthUrl = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        // Verificar que la compañía existe
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Compañía no encontrada',
                code: 'COMPANY_NOT_FOUND'
            });
        }

        // Obtener cliente OAuth2 (inicialización diferida)
        const oauth2Client = getOAuth2Client();
        
        // Generar URL de autenticación
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            state: companyId,
            prompt: 'consent'
        });

        return res.status(200).json({
            success: true,
            message: 'URL de autenticación generada',
            data: {
                authUrl,
                companyId
            }
        });
    } catch (error) {
        console.error('Error al generar URL de autenticación:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno al generar URL de autenticación',
            code: 'INTERNAL_SERVER_ERROR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const handleCallback = async (req, res) => {
    console.log('🔄 Google OAuth Callback iniciado');
    
    try {
        const { code, state: companyId } = req.query;
        console.log('📋 Parámetros recibidos:', { hasCode: !!code, companyId });

        if (!code) {
            console.log('❌ Error: Código de autorización faltante');
            return res.status(400).json({
                success: false,
                message: 'Código de autorización no proporcionado',
                code: 'MISSING_AUTH_CODE'
            });
        }

        if (!companyId) {
            console.log('❌ Error: ID de compañía faltante');
            return res.status(400).json({
                success: false,
                message: 'ID de compañía no proporcionado',
                code: 'MISSING_COMPANY_ID'
            });
        }

        // Verificar que la compañía existe
        const company = await Company.findById(companyId);
        if (!company) {
            console.log('❌ Error: Compañía no encontrada:', companyId);
            return res.status(404).json({
                success: false,
                message: 'Compañía no encontrada',
                code: 'COMPANY_NOT_FOUND'
            });
        }
        
        console.log('✅ Compañía encontrada:', company.name || companyId);

        // Obtener cliente OAuth2 (inicialización diferida)
        const oauth2Client = getOAuth2Client();
        
        // Intercambiar el código por tokens
        console.log('🔑 Intercambiando código por tokens...');
        const { tokens } = await oauth2Client.getToken(code);
        
        // Actualizar la compañía con los tokens de Google
        const updateData = {
            'googleAuth.accessToken': tokens.access_token,
            'googleAuth.refreshToken': tokens.refresh_token,
            'googleAuth.tokenType': tokens.token_type || 'Bearer',
            'googleAuth.expiryDate': tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            'googleAuth.scope': tokens.scope ? tokens.scope.split(' ') : SCOPES,
            'googleAuth.isConnected': true
        };

        await Company.findByIdAndUpdate(companyId, updateData);
        console.log('✅ Tokens guardados exitosamente para compañía:', companyId);

        return res.status(200).json({
            success: true,
            message: 'Autenticación con Google Calendar completada exitosamente',
            data: {
                companyId,
                isConnected: true,
                scopes: tokens.scope ? tokens.scope.split(' ') : SCOPES
            }
        });
    } catch (error) {
        console.error('❌ Error en callback de Google OAuth:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error al procesar la autenticación con Google',
            code: 'OAUTH_CALLBACK_ERROR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Verifica el estado de la conexión con Google Calendar
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getConnectionStatus = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const company = await Company.findById(companyId, {
            'googleAuth.isConnected': 1,
            'googleAuth.expiryDate': 1,
            'googleAuth.scope': 1
        });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Compañía no encontrada',
                code: 'COMPANY_NOT_FOUND'
            });
        }

        const isTokenExpired = company.googleAuth?.expiryDate && 
            new Date() > company.googleAuth.expiryDate;

        return res.status(200).json({
            success: true,
            message: 'Estado de conexión obtenido',
            data: {
                isConnected: company.googleAuth?.isConnected || false,
                isTokenExpired,
                scopes: company.googleAuth?.scope || [],
                expiryDate: company.googleAuth?.expiryDate
            }
        });
    } catch (error) {
        console.error('Error al verificar estado de conexión:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al verificar el estado de conexión',
            code: 'INTERNAL_SERVER_ERROR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Desconecta la integración con Google Calendar
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const disconnect = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Compañía no encontrada',
                code: 'COMPANY_NOT_FOUND'
            });
        }

        // Limpiar los tokens de Google
        const updateData = {
            'googleAuth.accessToken': null,
            'googleAuth.refreshToken': null,
            'googleAuth.tokenType': 'Bearer',
            'googleAuth.expiryDate': null,
            'googleAuth.scope': [],
            'googleAuth.isConnected': false
        };

        await Company.findByIdAndUpdate(companyId, updateData);

        return res.status(200).json({
            success: true,
            message: 'Desconexión de Google Calendar completada',
            data: {
                companyId,
                isConnected: false
            }
        });
    } catch (error) {
        console.error('Error al desconectar Google Calendar:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al desconectar Google Calendar',
            code: 'INTERNAL_SERVER_ERROR',
            error: process.env.NODE_ENVIRONMENT === 'development' ? error.message : undefined
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

        const reservation = new Reservation(reservationData);
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
        await Reservation.findByIdAndUpdate(reservation._id, {
            $set: {
                googleCalendarEventId: calendarResponse.data.id
            }
        });

        console.log('✅ Evento creado en Google Calendar:', calendarResponse.data.id);

        // Obtener la reserva completa con populate
        const populatedReservation = await Reservation.findById(reservation._id)
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
                await Reservation.findByIdAndDelete(error.reservationId);
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

export default {
    getAuthUrl,
    handleCallback,
    getConnectionStatus,
    disconnect,
    createReservationWithCalendar
};