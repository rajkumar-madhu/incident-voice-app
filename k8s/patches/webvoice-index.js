import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { closeRedis, getRedisClient } from './db/redis.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authenticateSocket } from './middleware/auth.js';
import { setupVoiceSocket } from './sockets/voiceSocket.js';
import { httpRequestsTotal, httpRequestDuration } from './utils/metrics.js';
import healthRoutes from './routes/health.js';
import widgetRoutes from './routes/widget.js';
const app = express();
const httpServer = createServer(app);
const allowedOrigins = config.widgetAllowedOrigins === '*' ? '*' : config.widgetAllowedOrigins.split(',');
const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    maxHttpBufferSize: 1e7, // 10MB for audio chunks
});
// Relaxed CSP for integration pages (they use inline scripts/styles and CDN resources)
app.use('/integrations', helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https://voice.santhira.com", "wss://voice.santhira.com", "https://voice.api.santhira.com"],
            mediaSrc: ["'self'", "blob:"],
            workerSrc: ["'self'", "blob:"],
            imgSrc: ["'self'", "data:"],
        },
    },
}));
// Default strict helmet for all other routes
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/metrics' },
}));
app.use((req, res, next) => {
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
app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
});
app.use('/', healthRoutes);
app.use('/', widgetRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
// Socket.IO auth middleware
io.use(authenticateSocket);
// Setup voice socket handlers
setupVoiceSocket(io);
const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutdown signal received');
    io.close();
    await closeRedis();
    logger.info('Graceful shutdown complete');
    process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
const start = async () => {
    try {
        await getRedisClient();
        httpServer.listen(config.port, () => {
            logger.info({ port: config.port, env: config.nodeEnv }, 'Webvoice service started');
        });
    }
    catch (err) {
        logger.fatal({ err }, 'Failed to start server');
        process.exit(1);
    }
};
start();
export default app;
//# sourceMappingURL=index.js.map
