import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
  port: z.coerce.number().default(4004),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  redisUrl: z.string().url(),
  jwtSecret: z.string().min(32),
  widgetAllowedOrigins: z.string().default('*'),
  sttServiceUrl: z.string().url().default('http://localhost:8001'),
  ttsServiceUrl: z.string().url().default('http://localhost:8002'),
  orchestratorUrl: z.string().url().default('http://localhost:4002'),
  sessionTimeoutMs: z.coerce.number().default(300000),
  maxSessionDurationMs: z.coerce.number().default(1800000),
  audioSampleRate: z.coerce.number().default(16000),
  vadSilenceThresholdMs: z.coerce.number().default(1500),
  vadEnergyThreshold: z.coerce.number().default(0.01),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parseConfig = () => {
  const result = ConfigSchema.safeParse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    widgetAllowedOrigins: process.env.WIDGET_ALLOWED_ORIGINS,
    sttServiceUrl: process.env.STT_SERVICE_URL,
    ttsServiceUrl: process.env.TTS_SERVICE_URL,
    orchestratorUrl: process.env.ORCHESTRATOR_URL,
    sessionTimeoutMs: process.env.SESSION_TIMEOUT_MS,
    maxSessionDurationMs: process.env.MAX_SESSION_DURATION_MS,
    audioSampleRate: process.env.AUDIO_SAMPLE_RATE,
    vadSilenceThresholdMs: process.env.VAD_SILENCE_THRESHOLD_MS,
    vadEnergyThreshold: process.env.VAD_ENERGY_THRESHOLD,
    logLevel: process.env.LOG_LEVEL,
  });

  if (!result.success) {
    // eslint-disable-next-line no-console -- logger not yet initialized
    console.error('Invalid configuration:', result.error.format());
    process.exit(1);
  }
  return result.data;
};

export const config = parseConfig();
export type Config = z.infer<typeof ConfigSchema>;
