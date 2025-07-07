const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  }
});

const deleteFile = async (fileName) => {
  try {
    await R2.send(new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'sordomundobuckets3',
      Key: fileName
    }));
    console.log(`Archivo ${fileName} eliminado correctamente`);
    return true;
  } catch (error) {
    console.error(`Error eliminando archivo ${fileName}:`, error);
    throw error;
  }
};

module.exports = { deleteFile };