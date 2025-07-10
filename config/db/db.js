// cargar variables de entorno
import 'dotenv/config';
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_SERVER_MONGO, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: process.env.DB_NAME_MONGO,
    });
    console.log(
      `MongoDB conectado a "${process.env.DB_NAME_MONGO}"`
    );
  } catch (err) {
    console.error(
      'Error de conexión a MongoDB:',
      err.message
    );
    process.exit(1);
  }
};

export default connectDB;