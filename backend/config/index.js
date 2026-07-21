import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3070,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3060',
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  turnstile: {
    secret: process.env.TURNSTILE_SECRET,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM || 'noreply@lumora.dev',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl: process.env.GITHUB_CALLBACK_URL,
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'groq',
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    groqModelFast: process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant',
  },
  kofi: {
    pageUrl: process.env.KOFI_PAGE_URL,
    webhookToken: process.env.KOFI_WEBHOOK_TOKEN,
  },
};

export default config;
