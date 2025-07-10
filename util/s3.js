import 'dotenv/config';
import { S3 } from 'aws-sdk';
import { readFileSync } from 'fs';

// Configura las credenciales y el endpoint específico de R2
const s3 = new S3({
  endpoint: process.env.CLOUDFLARE_ENDPOINT, // Endpoint de Cloudflare R2
  accessKeyId: process.env.AWS_ACCESS_KEY_ID, // ID de clave de acceso
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Clave de acceso secreta
  region: process.env.AWS_REGION, // Región, 'auto' para R2
  s3ForcePathStyle: true, // Esto es necesario para R2
});

const uploadFile = async (fileName, fileBuffer, mimeType) => {
  // Ya no necesitamos leer el archivo, usamos directamente el buffer
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME, // Nombre del bucket
    Key: `sordomundomultimedia/${fileName}`, // Ruta y nombre del archivo
    Body: fileBuffer, // Contenido del archivo como buffer
    ContentType: mimeType, // Tipo MIME del archivo
  };

  try {
    const data = await s3.upload(params).promise();
    console.log(`Archivo subido correctamente a ${data.Location}`);
    
    // Retorna la URL pública basada en el subdominio de R2
    const publicUrl = `https://s3.sordomundo.pro/sordomundomultimedia/${fileName}`;
    
    // Retorna la URL pública para almacenarla en la base de datos
    return publicUrl;
  } catch (err) {
    console.error(`Error al subir archivo a Cloudflare R2: ${err.message}`);
    throw err;
  }
};

export {
  uploadFile,
};