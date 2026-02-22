import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const chatRequestsTotal = new Counter({
  name: 'chat_requests_total',
  help: 'Total chat requests',
  labelNames: ['status'],
  registers: [registry],
});

export const llmLatency = new Histogram({
  name: 'llm_latency_seconds',
  help: 'LLM response latency',
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [registry],
});

export const ragLatency = new Histogram({
  name: 'rag_latency_seconds',
  help: 'RAG retrieval latency',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

export const conversationCount = new Gauge({
  name: 'active_conversations',
  help: 'Active conversation count',
  registers: [registry],
});

export const rateLimitHits = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total rate limit hits',
  labelNames: ['tenant_id', 'plan'],
  registers: [registry],
});

export const authAttemptsTotal = new Counter({
  name: 'auth_attempts_total',
  help: 'Total auth attempts',
  labelNames: ['type', 'status'],
  registers: [registry],
});

export const getMetrics = async (): Promise<string> => {
  return registry.metrics();
};

export const getContentType = (): string => {
  return registry.contentType;
};
