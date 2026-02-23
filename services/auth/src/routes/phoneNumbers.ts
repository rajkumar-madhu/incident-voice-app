import { Router, Request, Response, NextFunction } from 'express';
import * as phoneNumberService from '../services/phoneNumberService.js';
import { CreatePhoneNumberSchema, UpdatePhoneNumberSchema } from '../types/dashboard.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post(
  '/',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreatePhoneNumberSchema.parse(req.body);
      const phoneNumber = await phoneNumberService.createPhoneNumber(req.context!.tenant_id, data);
      res.status(201).json({ success: true, data: { phoneNumber } });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const phoneNumbers = await phoneNumberService.listPhoneNumbers(req.context!.tenant_id);
      res.json({ success: true, data: { phoneNumbers } });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:phone_id',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const phoneNumber = await phoneNumberService.getPhoneNumberById(req.params.phone_id, req.context!.tenant_id);
      res.json({ success: true, data: { phoneNumber } });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:phone_id',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = UpdatePhoneNumberSchema.parse(req.body);
      const phoneNumber = await phoneNumberService.updatePhoneNumber(req.params.phone_id, req.context!.tenant_id, data);
      res.json({ success: true, data: { phoneNumber } });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:phone_id',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await phoneNumberService.deletePhoneNumber(req.params.phone_id, req.context!.tenant_id);
      res.json({ success: true, message: 'Phone number released' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
