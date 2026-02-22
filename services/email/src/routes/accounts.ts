import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { CreateEmailAccountSchema, UpdateEmailAccountSchema } from '../types/index.js';
import * as accountService from '../services/accountService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

const router = Router();

router.post('/v1/accounts', authenticate, rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateEmailAccountSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid account data', parsed.error.errors);
    const account = await accountService.createAccount(req.context!.tenant_id, parsed.data);
    res.status(201).json({ success: true, data: account });
  } catch (err) { next(err); }
});

router.get('/v1/accounts', authenticate, rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await accountService.getAccounts(req.context!.tenant_id);
    res.json({ success: true, data: accounts });
  } catch (err) { next(err); }
});

router.patch('/v1/accounts/:account_id', authenticate, rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateEmailAccountSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid update data', parsed.error.errors);
    const updated = await accountService.updateAccount(req.context!.tenant_id, req.params.account_id, parsed.data);
    if (!updated) throw new NotFoundError('Email account');
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/v1/accounts/:account_id', authenticate, rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await accountService.deleteAccount(req.context!.tenant_id, req.params.account_id);
    if (!deleted) throw new NotFoundError('Email account');
    res.json({ success: true, data: { deleted: true } });
  } catch (err) { next(err); }
});

export default router;
