import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/postgres.js', () => ({
  query: vi.fn(), transaction: vi.fn(), pool: { query: vi.fn() },
  checkConnection: vi.fn().mockResolvedValue(true), closePool: vi.fn(),
}));

vi.mock('../db/redis.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue({ ping: vi.fn() }),
  checkRedisConnection: vi.fn().mockResolvedValue(true),
  closeRedis: vi.fn(), incrementRateLimit: vi.fn().mockResolvedValue(1),
}));

vi.mock('../config.js', () => ({
  config: {
    port: 4003, nodeEnv: 'test',
    databaseUrl: 'postgresql://localhost:5432/test', redisUrl: 'redis://localhost:6379',
    jwtSecret: 'test-secret-key-that-is-at-least-32-chars-long',
    emailEncryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    imapPollIntervalSeconds: 60, imapMaxEmailsPerPoll: 100,
    smtpQueueConcurrency: 5, smtpMaxRetries: 3, smtpRetryDelaySeconds: 60,
    attachmentStoragePath: './data/attachments', attachmentMaxSizeMb: 25,
    orchestratorUrl: 'http://localhost:4002', logLevel: 'error',
    rateLimitFree: 60, rateLimitPro: 300, rateLimitEnterprise: 1000,
  },
}));

vi.mock('../workers/imapWorker.js', () => ({
  startImapPoller: vi.fn(), stopImapPoller: vi.fn(),
}));

vi.mock('../services/queueService.js', () => ({
  createSmtpWorker: vi.fn().mockReturnValue({ close: vi.fn() }),
  addSendJob: vi.fn().mockResolvedValue('job-123'),
  smtpQueue: { add: vi.fn() },
}));

import { encrypt, decrypt } from '../utils/encryption.js';

describe('Email Service', () => {
  it('should encrypt and decrypt data', () => {
    const original = 'my-secret-password';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
    expect(encrypted).not.toBe(original);
  });
});
