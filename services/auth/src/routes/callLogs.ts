import { Router, Request, Response, NextFunction } from 'express';
import * as callLogService from '../services/callLogService.js';
import { CallLogFilterSchema } from '../types/dashboard.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.get(
  '/',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = CallLogFilterSchema.parse(req.query);
      const result = await callLogService.listCallLogs(req.context!.tenant_id, filters);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:call_id',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const callLog = await callLogService.getCallLogById(req.params.call_id, req.context!.tenant_id);
      res.json({ success: true, data: { callLog } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
