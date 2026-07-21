import mongoose from 'mongoose';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

export async function connectDatabase() {
  try {
    await mongoose.connect(config.mongodbUri);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error', { error: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
}
