import { Request, Response, NextFunction } from 'express';
import { incrementRateLimit } from '../db/redis.js';
import { query } from '../db/postgres.js';
import { rateLimitHits } from '../utils/metrics.js';
import { RateLimitError } from './errorHandler.js';
import { RATE_LIMITS, type Plan } from '../types/index.js';
import { logger } from '../utils/logger.js';

const WINDOW_SECONDS = 60;

export const rateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.context?.tenant_id) { return next(); }
  try {
    const tenants = await query<{ plan: Plan }>(
      'SELECT plan FROM tenants WHERE id = $1 AND is_active = true',
      [req.context.tenant_id]
    );
    if (tenants.length === 0) { return next(); }
    const plan = tenants[0].plan;
    const limit = RATE_LIMITS[plan];
    const key = `ratelimit:${req.context.tenant_id}:${Math.floor(Date.now() / (WINDOW_SECONDS * 1000))}`;
    const current = await incrementRateLimit(key, WINDOW_SECONDS);
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
    res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + WINDOW_SECONDS);
    if (current > limit) {
      rateLimitHits.inc({ tenant_id: req.context.tenant_id, plan });
      return next(new RateLimitError(WINDOW_SECONDS));
    }
    next();
  } catch (err) {
    logger.error({ err }, 'Rate limiter error, allowing request');
    next();
  }
};
