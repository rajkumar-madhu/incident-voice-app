import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total', help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'], registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds', help: 'HTTP request duration',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], registers: [registry],
});

export const emailsReceived = new Counter({
  name: 'emails_received_total', help: 'Emails received via IMAP',
  labelNames: ['tenant_id'], registers: [registry],
});

export const emailsSent = new Counter({
  name: 'emails_sent_total', help: 'Emails sent via SMTP',
  labelNames: ['tenant_id', 'status'], registers: [registry],
});

export const imapPolls = new Counter({
  name: 'imap_polls_total', help: 'IMAP poll operations',
  labelNames: ['status'], registers: [registry],
});

export const smtpQueueSize = new Gauge({
  name: 'smtp_queue_size', help: 'SMTP send queue size', registers: [registry],
});

export const rateLimitHits = new Counter({
  name: 'rate_limit_hits_total', help: 'Rate limit hits',
  labelNames: ['tenant_id', 'plan'], registers: [registry],
});

export const authAttemptsTotal = new Counter({
  name: 'auth_attempts_total', help: 'Auth attempts',
  labelNames: ['type', 'status'], registers: [registry],
});

export const getMetrics = async (): Promise<string> => registry.metrics();
export const getContentType = (): string => registry.contentType;
