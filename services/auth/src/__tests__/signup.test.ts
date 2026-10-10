/**
 * Public sign-up and admin-only user registration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const clientQuery = vi.fn();
const query = vi.fn();

vi.mock('../config.js', () => ({
  config: {
    jwtSecret: 'x'.repeat(32),
    jwtExpiresIn: '7d',
    jwtRefreshExpiresIn: '30d',
    apiKeyHashRounds: 4,
  },
}));
vi.mock('../db/postgres.js', () => ({
  query: (...args: unknown[]) => query(...args),
  transaction: async (cb: (client: { query: typeof clientQuery }) => unknown) =>
    cb({ query: clientQuery }),
}));
vi.mock('../db/redis.js', () => ({
  blacklistToken: vi.fn(),
  isTokenBlacklisted: vi.fn(),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const { signupWithTenant, registerUser } = await import('../services/authService.js');
const { SignupSchema } = await import('../types/index.js');
const { ConflictError, AuthorizationError } = await import('../middleware/errorHandler.js');

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';

const signup = {
  organizationName: 'Acme Support',
  name: 'Asha Rao',
  email: 'Asha@Acme.example',
  password: 'correct-horse-9',
};

beforeEach(() => {
  clientQuery.mockReset();
  query.mockReset();
});

describe('SignupSchema', () => {
  it('accepts a complete sign-up and lower-cases the email', () => {
    const parsed = SignupSchema.parse(signup);
    expect(parsed.email).toBe('asha@acme.example');
  });

  it('does not let the caller choose a role or tenant', () => {
    const parsed = SignupSchema.parse({ ...signup, role: 'admin', tenant_id: TENANT });
    expect(parsed).not.toHaveProperty('role');
    expect(parsed).not.toHaveProperty('tenant_id');
  });

  it('rejects a short password', () => {
    expect(() => SignupSchema.parse({ ...signup, password: 'short' })).toThrow();
  });
});

describe('signupWithTenant', () => {
  it('creates the organisation and its admin in one transaction and signs them in', async () => {
    clientQuery
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: TENANT, name: 'Acme Support', plan: 'free' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'u1', tenant_id: TENANT, email: 'asha@acme.example', name: 'Asha Rao', role: 'admin' }],
      });

    const result = await signupWithTenant(SignupSchema.parse(signup));

    expect(result.tenant.id).toBe(TENANT);
    expect(result.user.role).toBe('admin');
    expect(result.tokens.accessToken).toBeTruthy();
    const userInsert = clientQuery.mock.calls[2];
    expect(userInsert[0]).toContain('INSERT INTO users');
    expect(userInsert[1]).toContain(TENANT);
    expect(userInsert[1]).toContain('admin');
    expect(userInsert[1]).not.toContain(signup.password);
  });

  it('refuses an email that already has an account, and inserts nothing', async () => {
    clientQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] });

    await expect(signupWithTenant(SignupSchema.parse(signup))).rejects.toBeInstanceOf(ConflictError);
    expect(clientQuery).toHaveBeenCalledTimes(1);
  });

  it('reports a concurrent sign-up with the same email as a conflict', async () => {
    clientQuery
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

    await expect(signupWithTenant(SignupSchema.parse(signup))).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('registerUser', () => {
  const newUser = {
    tenant_id: OTHER_TENANT,
    email: 'mallory@example.com',
    password: 'long-enough-1',
    name: 'Mallory',
    role: 'admin' as const,
  };

  it('refuses to add a user to a tenant other than the caller’s', async () => {
    await expect(registerUser(newUser, TENANT)).rejects.toBeInstanceOf(AuthorizationError);
    expect(query).not.toHaveBeenCalled();
  });
});
