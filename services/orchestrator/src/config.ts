import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
  port: z.coerce.number().default(4002),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  databaseUrl: z.string().url(),
  redisUrl: z.string().url(),
  jwtSecret: z.string().min(32),
  sttServiceUrl: z.string().url().default('http://localhost:8001'),
  ttsServiceUrl: z.string().url().default('http://localhost:8002'),
  ragServiceUrl: z.string().url().default('http://localhost:8003'),
  flowiseUrl: z.string().url().default('http://localhost:3000'),
  flowiseFlowId: z.string().default('default'),
  flowiseApiKey: z.string().default(''),
  rateLimitFree: z.coerce.number().default(60),
  rateLimitPro: z.coerce.number().default(300),
  rateLimitEnterprise: z.coerce.number().default(1000),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ragTimeoutMs: z.coerce.number().default(10000),
  llmTimeoutMs: z.coerce.number().default(60000),
  maxConversationHistory: z.coerce.number().default(10),
});

const parseConfig = () => {
  const result = ConfigSchema.safeParse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    sttServiceUrl: process.env.STT_SERVICE_URL,
    ttsServiceUrl: process.env.TTS_SERVICE_URL,
    ragServiceUrl: process.env.RAG_SERVICE_URL,
    flowiseUrl: process.env.FLOWISE_URL,
    flowiseFlowId: process.env.FLOWISE_FLOW_ID,
    flowiseApiKey: process.env.FLOWISE_API_KEY,
    rateLimitFree: process.env.RATE_LIMIT_FREE,
    rateLimitPro: process.env.RATE_LIMIT_PRO,
    rateLimitEnterprise: process.env.RATE_LIMIT_ENTERPRISE,
    logLevel: process.env.LOG_LEVEL,
    ragTimeoutMs: process.env.RAG_TIMEOUT_MS,
    llmTimeoutMs: process.env.LLM_TIMEOUT_MS,
    maxConversationHistory: process.env.MAX_CONVERSATION_HISTORY,
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
