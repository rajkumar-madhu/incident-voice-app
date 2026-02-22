import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { SendEmailSchema } from '../types/index.js';
import { query } from '../db/postgres.js';
import { addSendJob } from '../services/queueService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import type { Email } from '../types/index.js';

const router = Router();

router.get('/v1/emails', authenticate, rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const accountId = req.query.account_id as string;

    let sql = 'SELECT * FROM emails WHERE tenant_id = $1';
    const params: unknown[] = [req.context!.tenant_id];

    if (accountId) { sql += ` AND account_id = $${params.length + 1}`; params.push(accountId); }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const emails = await query<Email>(sql, params);
    res.json({ success: true, data: emails });
  } catch (err) { next(err); }
});

router.get('/v1/emails/:email_id', authenticate, rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query<Email>(
      'SELECT * FROM emails WHERE id = $1 AND tenant_id = $2', [req.params.email_id, req.context!.tenant_id]
    );
    if (rows.length === 0) throw new NotFoundError('Email');
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

router.post('/v1/emails/send', authenticate, rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = SendEmailSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid email data', parsed.error.errors);

    const jobId = await addSendJob({
      tenantId: req.context!.tenant_id,
      accountId: parsed.data.account_id,
      to: parsed.data.to,
      cc: parsed.data.cc,
      bcc: parsed.data.bcc,
      subject: parsed.data.subject,
      body: parsed.data.body,
      inReplyTo: parsed.data.in_reply_to,
    });

    res.status(202).json({ success: true, data: { job_id: jobId, status: 'queued' } });
  } catch (err) { next(err); }
});

export default router;
