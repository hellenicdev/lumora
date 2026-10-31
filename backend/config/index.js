import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || 'https://hellenicdev.eu';
  const origins = new Set(raw.split(',').map((item) => item.trim()).filter(Boolean));
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    try {
      origins.add(new URL(frontendUrl).origin);
    } catch {
      throw new Error('FRONTEND_URL must be an absolute URL');
    }
  }
  return [...origins];
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3070,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3060',
  allowedOrigins: parseAllowedOrigins(),
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    secret: requiredEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: requiredEnv('JWT_REFRESH_SECRET'),
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
    apiKey: process.env.AI_API_KEY || process.env.GROQ_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    groqModelFast: process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant',
  },
  kofi: {
    pageUrl: process.env.KOFI_PAGE_URL,
    webhookToken: requiredEnv('KOFI_WEBHOOK_TOKEN'),
  },
};

export function isAllowedOrigin(origin) {
  if (!origin || origin === 'null') return false;
  if (config.allowedOrigins.includes(origin)) return true;
  if (config.nodeEnv === 'production') return false;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

export default config;
