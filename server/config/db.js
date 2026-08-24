import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error(
        'MONGODB_URI is missing from the .env file'
      );
    }

    const conn = await mongoose.connect(uri);

    console.log(
      `✅ MongoDB Connected: ${conn.connection.host}`
    );

  } catch (error) {
    console.error(
      '❌ MongoDB Error:',
      error.message
    );

    throw error;
  }
};

export default connectDB;