import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { httpRequestsTotal, httpRequestDuration, activeConnections } from './utils/metrics.js';

// Routes
import healthRoutes from './routes/health.js';
import voiceRoutes from './routes/voice.js';
import twilioRoutes from './routes/twilio.js';

const app = express();

// One hop (the ingress controller) sits in front, so req.ip is the client.
// Auth rate-limits sign-in by IP and sees only what the gateway forwards.
app.set('trust proxy', 1);

// Track active connections
app.use((_req: Request, res: Response, next: NextFunction) => {
  activeConnections.inc();
  res.on('finish', () => activeConnections.dec());
  next();
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.nodeEnv === 'production'
    ? config.allowedOrigins.split(',').filter(Boolean)
    : '*',
  credentials: true,
}));

// Request parsing
app.use(express.json({ limit: '50mb' })); // Large for audio
app.use(express.urlencoded({ extended: true }));

// Request ID
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Request logging
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req: { url?: string }) => req.url?.startsWith('/health') || req.url === '/metrics',
  },
  customProps: (req) => ({
    tenantId: (req as unknown as Request).context?.tenant_id,
    requestId: (req as unknown as Request).headers['x-request-id'],
  }),
}));

// Request timing
app.use((req: Request, res: Response, next: NextFunction) => {
  req.startTime = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - (req.startTime || Date.now())) / 1000;
    const path = req.route?.path || req.path;

    if (!path.startsWith('/health') && path !== '/metrics') {
      httpRequestsTotal.inc({
        method: req.method,
        path,
        status: res.statusCode,
        service: 'gateway',
      });
      httpRequestDuration.observe(
        { method: req.method, path, status: res.statusCode, service: 'gateway' },
        duration
      );
    }
  });

  next();
});

// Routes
app.use('/', healthRoutes);
app.use('/v1/voice', voiceRoutes);
app.use('/twilio', twilioRoutes);  // Twilio webhooks (no auth - uses signature validation)

// Proxy auth routes
app.use('/auth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { proxyRequest } = await import('./services/proxyService.js');
    const result = await proxyRequest({
      service: 'auth',
      method: req.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      path: `/auth${req.path}`,
      data: req.body,
      params: req.query as Record<string, string>,
      headers: {
        'Authorization': req.headers.authorization || '',
        'X-API-Key': req.headers['x-api-key'] as string || '',
        'X-Request-ID': req.headers['x-request-id'] as string,
        'X-Forwarded-For': req.ip || '',
      },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    next(err);
  }
});

// Proxy tenant routes
app.use('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { proxyRequest } = await import('./services/proxyService.js');
    const result = await proxyRequest({
      service: 'auth',
      method: req.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      path: `/tenants${req.path}`,
      data: req.body,
      params: req.query as Record<string, string>,
      headers: {
        'Authorization': req.headers.authorization || '',
        'X-API-Key': req.headers['x-api-key'] as string || '',
        'X-Request-ID': req.headers['x-request-id'] as string,
        'X-Forwarded-For': req.ip || '',
      },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    next(err);
  }
});

// Proxy dashboard routes → auth service
const dashboardPaths = ['/dashboard', '/call-logs', '/analytics', '/agents', '/billing', '/phone-numbers', '/api-keys', '/users'];
for (const basePath of dashboardPaths) {
  app.use(basePath, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { proxyRequest } = await import('./services/proxyService.js');
      const result = await proxyRequest({
        service: 'auth',
        method: req.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        path: `${basePath}${req.path}`,
        data: req.body,
        params: req.query as Record<string, string>,
        headers: {
          'Authorization': req.headers.authorization || '',
          'X-API-Key': req.headers['x-api-key'] as string || '',
          'X-Request-ID': req.headers['x-request-id'] as string,
          'X-Tenant-ID': req.headers['x-tenant-id'] as string || '',
        },
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      next(err);
    }
  });
}

// Proxy Finspot webhook receiver routes
const FINSPOT_WEBHOOK_URL = process.env.FINSPOT_WEBHOOK_URL || 'http://finspot-webhook:3100';
app.use('/api/webhooks/voice', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const upstream = await fetch(`${FINSPOT_WEBHOOK_URL}/api/webhooks/voice`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': req.headers['x-api-key'] as string || '',
        'X-Webhook-Event': req.headers['x-webhook-event'] as string || '',
        'X-Request-ID': req.headers['x-request-id'] as string || '',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    next(err);
  }
});
app.use('/api/voice', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const upstream = await fetch(`${FINSPOT_WEBHOOK_URL}/api/voice${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    next(err);
  }
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received');
  const { closeCallEventPublisher } = await import('./services/callEventPublisher.js');
  await closeCallEventPublisher();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
app.listen(config.port, () => {
  logger.info({
    port: config.port,
    env: config.nodeEnv,
  }, 'API Gateway started');
});

export default app;
