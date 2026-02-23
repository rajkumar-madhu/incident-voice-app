import { Router, Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analyticsService.js';
import { AnalyticsQuerySchema } from '../types/dashboard.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get(
  '/calls-over-time',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = AnalyticsQuerySchema.parse(req.query);
      const data = await analyticsService.getCallsOverTime(req.context!.tenant_id, params);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/cost-over-time',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = AnalyticsQuerySchema.parse(req.query);
      const data = await analyticsService.getCostOverTime(req.context!.tenant_id, params);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/latency-percentiles',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = AnalyticsQuerySchema.parse(req.query);
      const data = await analyticsService.getLatencyPercentiles(req.context!.tenant_id, params);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/agent-performance',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = AnalyticsQuerySchema.parse(req.query);
      const data = await analyticsService.getAgentPerformance(req.context!.tenant_id, params);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/call-heatmap',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await analyticsService.getCallHeatmap(req.context!.tenant_id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
