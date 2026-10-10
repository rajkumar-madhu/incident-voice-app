/**
 * The strict limiter guards sign-in, sign-up and register separately, so a
 * failed sign-up does not use up the same caller's sign-in attempts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const incrementRateLimit = vi.fn();

vi.mock('../db/redis.js', () => ({
  incrementRateLimit: (...args: unknown[]) => incrementRateLimit(...args),
}));
vi.mock('../db/postgres.js', () => ({ query: vi.fn() }));
vi.mock('../utils/metrics.js', () => ({ rateLimitHits: { inc: vi.fn() } }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const { createRateLimiter } = await import('../middleware/rateLimiter.js');

const call = async (path: string, ip = '203.0.113.7') => {
  const req = { ip, baseUrl: '/auth', path } as never;
  const res = { setHeader: vi.fn() } as never;
  const next = vi.fn();
  await createRateLimiter(5, 300)(req, res, next);
  return incrementRateLimit.mock.calls.at(-1)![0] as string;
};

beforeEach(() => {
  incrementRateLimit.mockReset();
  incrementRateLimit.mockResolvedValue(1);
});

describe('createRateLimiter', () => {
  it('keeps a separate count per route for the same client', async () => {
    expect(await call('/login')).not.toBe(await call('/signup'));
  });

  it('keeps a separate count per client on the same route', async () => {
    expect(await call('/login', '203.0.113.7')).not.toBe(await call('/login', '198.51.100.9'));
  });
});
