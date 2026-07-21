import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import config from './config/index.js';
import { connectDatabase } from './database/index.js';
import { logger } from './utils/logger.js';
import { initializeSocket } from './socket/index.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { ensureIndexes } from './config/indexes.js';
import { getQueue } from './jobs/queue.js';
import { processImport } from './services/importService.js';
import routes from './routes/index.js';

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({
  origin: config.nodeEnv === 'development'
    ? true
    : config.frontendUrl,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use('/api', apiLimiter);
app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: config.nodeEnv === 'development' ? err.stack : undefined });
  res.status(500).json({
    success: false,
    error: config.nodeEnv === 'development' ? err.message : 'Internal server error',
  });
});

async function start() {
  await connectDatabase();
  await ensureIndexes();
  initializeSocket(server);

  const importQueue = getQueue('repository-import');
  importQueue.process(async (job) => {
    await processImport(job);
  });

  server.listen(config.port, () => {
    logger.info(`Lumora API running on port ${config.port}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});

export default app;
