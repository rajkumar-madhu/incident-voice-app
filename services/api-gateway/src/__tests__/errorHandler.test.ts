/**
 * Upstream 4xx responses reach the browser as the service wrote them.
 */
import { describe, it, expect, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));
vi.mock('../utils/metrics.js', () => ({
  httpRequestsTotal: { inc: vi.fn() },
  httpRequestDuration: { observe: vi.fn() },
}));
vi.mock('./../middleware/auth.js', () => ({ AuthError: class AuthError extends Error {} }));

const { errorHandler } = await import('../middleware/errorHandler.js');

const upstreamError = (status: number, data: unknown) => {
  const config = { baseURL: 'http://auth:4001', headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
};

const run = (err: Error) => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const req = { headers: {}, method: 'POST', path: '/auth/signup' };
  errorHandler(err, req as never, res as never, vi.fn());
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
};

describe('errorHandler with an upstream response', () => {
  it('passes a 4xx error code, message and details through', () => {
    const details = [{ path: 'email', message: 'Invalid email' }];
    const { status, body } = run(
      upstreamError(400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details } })
    );

    expect(status).toBe(400);
    expect(body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'Invalid request data', details });
  });

  it('never exposes the internal service address', () => {
    const { body } = run(upstreamError(409, { error: { code: 'CONFLICT', message: 'taken' } }));
    expect(JSON.stringify(body)).not.toContain('auth:4001');

    const { body: serverBody } = run(upstreamError(503, {}));
    expect(JSON.stringify(serverBody)).not.toContain('auth:4001');
  });
});
