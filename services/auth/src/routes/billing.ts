import { Router, Request, Response, NextFunction } from 'express';
import * as billingService from '../services/billingService.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get(
  '/current-period',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await billingService.getCurrentPeriodBilling(req.context!.tenant_id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/history',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await billingService.getBillingHistory(req.context!.tenant_id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/cost-breakdown',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await billingService.getCostBreakdown(req.context!.tenant_id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
