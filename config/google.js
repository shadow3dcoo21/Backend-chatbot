import { google } from 'googleapis';

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

export default getOAuth2Client;