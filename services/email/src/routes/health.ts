import { Router, Request, Response } from 'express';
import { checkConnection } from '../db/postgres.js';
import { checkRedisConnection } from '../db/redis.js';
import { getMetrics, getContentType } from '../utils/metrics.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const [dbHealthy, redisHealthy] = await Promise.all([checkConnection(), checkRedisConnection()]);
    const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';
    res.status(status === 'healthy' ? 200 : 503).json({
      status, version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(), timestamp: new Date().toISOString(),
      checks: { database: dbHealthy, redis: redisHealthy },
    });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(503).json({ status: 'unhealthy', checks: { database: false, redis: false } });
  }
});

router.get('/health/live', (_req: Request, res: Response) => { res.status(200).json({ status: 'alive' }); });

router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const [db, redis] = await Promise.all([checkConnection(), checkRedisConnection()]);
    if (db && redis) res.status(200).json({ status: 'ready' });
    else res.status(503).json({ status: 'not ready', database: db, redis });
  } catch { res.status(503).json({ status: 'not ready' }); }
});

router.get('/metrics', async (_req: Request, res: Response) => {
  try { res.set('Content-Type', getContentType()); res.send(await getMetrics()); }
  catch (err) { logger.error({ err }, 'Failed to get metrics'); res.status(500).send('Error collecting metrics'); }
});

export default router;
