import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
  port: z.coerce.number().default(4003),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  databaseUrl: z.string().url(),
  redisUrl: z.string().url(),
  jwtSecret: z.string().min(32),
  emailEncryptionKey: z.string().length(64),
  imapPollIntervalSeconds: z.coerce.number().default(60),
  imapMaxEmailsPerPoll: z.coerce.number().default(100),
  smtpQueueConcurrency: z.coerce.number().default(5),
  smtpMaxRetries: z.coerce.number().default(3),
  smtpRetryDelaySeconds: z.coerce.number().default(60),
  attachmentStoragePath: z.string().default('./data/attachments'),
  attachmentMaxSizeMb: z.coerce.number().default(25),
  orchestratorUrl: z.string().url().default('http://localhost:4002'),
  rateLimitFree: z.coerce.number().default(60),
  rateLimitPro: z.coerce.number().default(300),
  rateLimitEnterprise: z.coerce.number().default(1000),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parseConfig = () => {
  const result = ConfigSchema.safeParse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    emailEncryptionKey: process.env.EMAIL_ENCRYPTION_KEY,
    imapPollIntervalSeconds: process.env.IMAP_POLL_INTERVAL_SECONDS,
    imapMaxEmailsPerPoll: process.env.IMAP_MAX_EMAILS_PER_POLL,
    smtpQueueConcurrency: process.env.SMTP_QUEUE_CONCURRENCY,
    smtpMaxRetries: process.env.SMTP_MAX_RETRIES,
    smtpRetryDelaySeconds: process.env.SMTP_RETRY_DELAY_SECONDS,
    attachmentStoragePath: process.env.ATTACHMENT_STORAGE_PATH,
    attachmentMaxSizeMb: process.env.ATTACHMENT_MAX_SIZE_MB,
    orchestratorUrl: process.env.ORCHESTRATOR_URL,
    rateLimitFree: process.env.RATE_LIMIT_FREE,
    rateLimitPro: process.env.RATE_LIMIT_PRO,
    rateLimitEnterprise: process.env.RATE_LIMIT_ENTERPRISE,
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
