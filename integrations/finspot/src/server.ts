import express from 'express';
import { pino } from 'pino';
import {
  handleWebhook,
  getActiveCalls,
  getItsmTickets,
  getCallHistory,
  getStats,
} from './handlers.js';
import type { WebhookEvent } from './types.js';

const logger = pino({ level: 'info' });

const PORT = parseInt(process.env.PORT || '3100', 10);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

const app = express();
app.use(express.json({ limit: '5mb' }));

// ---- Webhook secret verification middleware ----
const verifyWebhookSecret = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  if (!WEBHOOK_SECRET) {
    // No secret configured, skip verification
    next();
    return;
  }

  const incomingSecret = req.headers['x-api-key'] as string;
  if (!incomingSecret || incomingSecret !== WEBHOOK_SECRET) {
    logger.warn({ ip: req.ip, event: req.headers['x-webhook-event'] }, 'Webhook auth failed');
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }
  next();
};

// ============================================================
// Webhook endpoint - receives all voice agent events
// ============================================================
app.post(
  '/api/webhooks/voice',
  verifyWebhookSecret,
  (req: express.Request, res: express.Response) => {
    const event = (req.headers['x-webhook-event'] || req.body.event) as WebhookEvent;

    if (!event) {
      res.status(400).json({ error: 'Missing event type' });
      return;
    }

    // Process webhook (non-blocking)
    try {
      handleWebhook(event, req.body);
    } catch (err) {
      logger.error({ err, event }, 'Webhook handler error');
    }

    // Always respond 200 quickly to avoid retries
    res.status(200).json({ received: true, event });
  }
);

// ============================================================
// API endpoints - query webhook data from Finspot dashboard
// ============================================================

// Dashboard stats
app.get('/api/voice/stats', (_req, res) => {
  res.json({ success: true, data: getStats() });
});

// Active calls (live)
app.get('/api/voice/active-calls', (_req, res) => {
  res.json({ success: true, data: getActiveCalls() });
});

// Call history
app.get('/api/voice/call-history', (req, res) => {
  const limit = parseInt(req.query.limit as string || '50', 10);
  res.json({ success: true, data: getCallHistory(limit) });
});

// ITSM tickets created from voice calls
app.get('/api/voice/tickets', (req, res) => {
  const type = req.query.type as string;
  let tickets = getItsmTickets();
  if (type) tickets = tickets.filter(t => t.type === type);
  res.json({ success: true, data: tickets });
});

// Incidents only
app.get('/api/voice/incidents', (_req, res) => {
  res.json({
    success: true,
    data: getItsmTickets().filter(t => t.type === 'incident'),
  });
});

// Problems only
app.get('/api/voice/problems', (_req, res) => {
  res.json({
    success: true,
    data: getItsmTickets().filter(t => t.type === 'problem'),
  });
});

// Changes only
app.get('/api/voice/changes', (_req, res) => {
  res.json({
    success: true,
    data: getItsmTickets().filter(t => t.type === 'change'),
  });
});

// Health check
app.get('/api/voice/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'finspot-voice-webhook-receiver',
    timestamp: new Date().toISOString(),
    stats: getStats(),
  });
});

// ============================================================
// Start server
// ============================================================
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Finspot Voice Webhook Receiver started');
  logger.info('Endpoints:');
  logger.info('  POST /api/webhooks/voice     - Webhook receiver');
  logger.info('  GET  /api/voice/stats        - Dashboard stats');
  logger.info('  GET  /api/voice/active-calls - Live calls');
  logger.info('  GET  /api/voice/call-history - Call history');
  logger.info('  GET  /api/voice/tickets      - All ITSM tickets');
  logger.info('  GET  /api/voice/incidents    - Incidents');
  logger.info('  GET  /api/voice/problems     - Problems');
  logger.info('  GET  /api/voice/changes      - Change requests');

  if (!WEBHOOK_SECRET) {
    logger.warn('WEBHOOK_SECRET not set - webhook verification disabled');
  }
});
