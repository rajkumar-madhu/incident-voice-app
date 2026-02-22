import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { closePool } from './db/postgres.js';
import { closeRedis, getRedisClient } from './db/redis.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { httpRequestsTotal, httpRequestDuration } from './utils/metrics.js';

import healthRoutes from './routes/health.js';
import chatRoutes from './routes/chat.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.nodeEnv === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : '*',
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req: { url?: string }) => req.url === '/health' || req.url === '/metrics',
  },
  customProps: (req) => ({
    tenantId: (req as unknown as Request).context?.tenant_id,
  }),
}));

app.use((req: Request, res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - (req.startTime || Date.now())) / 1000;
    const path = req.route?.path || req.path;
    if (path !== '/health' && path !== '/metrics') {
      httpRequestsTotal.inc({ method: req.method, path, status: res.statusCode });
      httpRequestDuration.observe({ method: req.method, path, status: res.statusCode }, duration);
    }
  });
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string ||
    `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

app.use('/', healthRoutes);
app.use('/', chatRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received');
  await Promise.all([closePool(), closeRedis()]);
  logger.info('Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

const start = async () => {
  try {
    await getRedisClient();
    app.listen(config.port, () => {
      logger.info({ port: config.port, env: config.nodeEnv }, 'Orchestrator service started');
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
};

start();
export default app;
