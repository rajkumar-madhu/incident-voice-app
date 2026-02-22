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

export const activeSessions = new Gauge({
  name: 'webvoice_active_sessions', help: 'Active voice sessions',
  registers: [registry],
});

export const sessionDuration = new Histogram({
  name: 'webvoice_session_duration_seconds', help: 'Voice session duration',
  buckets: [10, 30, 60, 120, 300, 600, 1800], registers: [registry],
});

export const audioChunksProcessed = new Counter({
  name: 'webvoice_audio_chunks_processed', help: 'Audio chunks processed',
  labelNames: ['status'], registers: [registry],
});

export const sttRequests = new Counter({
  name: 'webvoice_stt_requests_total', help: 'STT requests',
  labelNames: ['status'], registers: [registry],
});

export const ttsRequests = new Counter({
  name: 'webvoice_tts_requests_total', help: 'TTS requests',
  labelNames: ['status'], registers: [registry],
});

export const getMetrics = async (): Promise<string> => registry.metrics();
export const getContentType = (): string => registry.contentType;
