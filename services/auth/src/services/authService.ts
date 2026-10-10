import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { query, transaction } from '../db/postgres.js';
import { blacklistToken, isTokenBlacklisted } from '../db/redis.js';
import { logger } from '../utils/logger.js';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
} from '../middleware/errorHandler.js';
import type { CreateUser, Login, Signup, User, JwtPayload } from '../types/index.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

/**
 * Parse JWT expiration string to seconds
 */
const parseExpiresIn = (expiresIn: string): number => {
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  if (!match) return 604800; // default 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'd': return value * 86400;
    case 'h': return value * 3600;
    case 'm': return value * 60;
    case 's': return value;
    default: return 604800;
  }
};

/**
 * Generate JWT token pair
 */
export const generateTokens = (user: User): TokenPair => {
  const accessExpiresIn = parseExpiresIn(config.jwtExpiresIn);
  const refreshExpiresIn = parseExpiresIn(config.jwtRefreshExpiresIn);

  const accessPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    tenant_id: user.tenant_id,
    email: user.email,
    role: user.role,
    type: 'access',
  };

  const refreshPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    tenant_id: user.tenant_id,
    email: user.email,
    role: user.role,
    type: 'refresh',
  };

  const accessToken = jwt.sign(accessPayload, config.jwtSecret, {
    expiresIn: accessExpiresIn,
  });

  const refreshToken = jwt.sign(refreshPayload, config.jwtSecret, {
    expiresIn: refreshExpiresIn,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: accessExpiresIn,
  };
};

const UNIQUE_VIOLATION = '23505';

// Login looks users up by email alone, so one email means one account across
// every tenant. Migration 004 backs this with unique indexes on lower(email).
const EMAIL_TAKEN_SQL = `SELECT 1 FROM users WHERE lower(email) = $1
  UNION ALL
  SELECT 1 FROM tenants WHERE lower(email) = $1
  LIMIT 1`;

/**
 * Public sign-up: a new organisation and its first admin, created together
 * so a failure never leaves a tenant without an owner.
 */
export const signupWithTenant = async (
  data: Signup
): Promise<{ tenant: { id: string; name: string; plan: string }; user: User; tokens: TokenPair }> => {
  const passwordHash = await bcrypt.hash(data.password, config.apiKeyHashRounds);

  try {
    return await transaction(async (client) => {
      const taken = await client.query(EMAIL_TAKEN_SQL, [data.email]);
      if (taken.rowCount) {
        throw new ConflictError('An account with this email already exists');
      }

      const tenantRows = await client.query(
        `INSERT INTO tenants (id, name, email, plan, settings, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'free', '{}', true, NOW(), NOW())
         RETURNING id, name, plan`,
        [uuidv4(), data.organizationName, data.email]
      );
      const tenant = tenantRows.rows[0];

      const userRows = await client.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
         RETURNING id, tenant_id, email, name, role, is_active, created_at, updated_at`,
        [uuidv4(), tenant.id, data.email, passwordHash, data.name, 'admin']
      );

      const user = userRows.rows[0] as User;
      logger.info({ userId: user.id, tenantId: tenant.id }, 'Organisation signed up');
      return { tenant, user, tokens: generateTokens(user) };
    });
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new ConflictError('An account with this email already exists');
    }
    throw err;
  }
};

/**
 * Add a user to the caller's own tenant. Only tenant admins reach this
 * (the route enforces the role); the tenant check stops cross-tenant writes.
 */
export const registerUser = async (
  data: CreateUser,
  actorTenantId: string
): Promise<{ user: User }> => {
  if (data.tenant_id !== actorTenantId) {
    throw new AuthorizationError('Cannot add users to another tenant');
  }

  // Check if tenant exists
  const tenants = await query<{ id: string }>(
    'SELECT id FROM tenants WHERE id = $1 AND is_active = true',
    [data.tenant_id]
  );

  if (tenants.length === 0) {
    throw new ValidationError('Invalid tenant_id');
  }

  const existing = await query<unknown>(EMAIL_TAKEN_SQL, [data.email]);
  if (existing.length > 0) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(data.password, config.apiKeyHashRounds);

  let users: User[];
  try {
    users = await query<User>(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       RETURNING id, tenant_id, email, name, role, is_active, created_at, updated_at`,
      [uuidv4(), data.tenant_id, data.email, passwordHash, data.name, data.role]
    );
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new ConflictError('An account with this email already exists');
    }
    throw err;
  }

  const user = users[0];
  logger.info({ userId: user.id, tenantId: user.tenant_id }, 'User registered');

  return { user };
};

/**
 * Login user with email and password
 */
export const loginUser = async (data: Login): Promise<{ user: User; tokens: TokenPair }> => {
  // Build query based on whether tenant_id is provided
  let queryText = 'SELECT * FROM users WHERE lower(email) = lower($1) AND is_active = true';
  const queryParams: unknown[] = [data.email];

  if (data.tenant_id) {
    queryText += ' AND tenant_id = $2';
    queryParams.push(data.tenant_id);
  }

  const users = await query<UserWithPassword>(queryText, queryParams);

  if (users.length === 0) {
    throw new AuthenticationError('Invalid email or password');
  }

  // If multiple users found (same email, different tenants), require tenant_id
  if (users.length > 1) {
    throw new ValidationError('Multiple accounts found. Please provide tenant_id');
  }

  const userWithPassword = users[0];

  // Verify password
  const isValid = await bcrypt.compare(data.password, userWithPassword.password_hash);
  if (!isValid) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Remove password from response
  const { password_hash: _hash, ...user } = userWithPassword;
  const tokens = generateTokens(user as User);

  logger.info({ userId: user.id, tenantId: user.tenant_id }, 'User logged in');

  return { user: user as User, tokens };
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (refreshToken: string): Promise<TokenPair> => {
  try {
    // Check if refresh token has been blacklisted (e.g., on logout)
    const blacklisted = await isTokenBlacklisted(refreshToken);
    if (blacklisted) {
      throw new AuthenticationError('Refresh token has been revoked');
    }

    const payload = jwt.verify(refreshToken, config.jwtSecret, {
      algorithms: ['HS256'],
    }) as JwtPayload;

    if (payload.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }

    // Get current user data
    const users = await query<User>(
      'SELECT id, tenant_id, email, name, role, is_active, created_at, updated_at FROM users WHERE id = $1 AND is_active = true',
      [payload.sub]
    );

    if (users.length === 0) {
      throw new AuthenticationError('User not found or inactive');
    }

    const tokens = generateTokens(users[0]);

    logger.info({ userId: users[0].id }, 'Token refreshed');

    return tokens;
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid refresh token');
    }
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Refresh token expired');
    }
    throw err;
  }
};

/**
 * Logout user (blacklist token)
 */
export const logoutUser = async (accessToken: string, refreshToken?: string): Promise<void> => {
  try {
    // Blacklist the access token
    const accessPayload = jwt.decode(accessToken) as JwtPayload;
    if (accessPayload?.exp) {
      const ttl = accessPayload.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await blacklistToken(accessToken, ttl);
      }
    }

    // Blacklist the refresh token if provided
    if (refreshToken) {
      const refreshPayload = jwt.decode(refreshToken) as JwtPayload;
      if (refreshPayload?.exp) {
        const ttl = refreshPayload.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await blacklistToken(refreshToken, ttl);
        }
      }
    }

    logger.info({ userId: accessPayload?.sub }, 'User logged out');
  } catch (err) {
    // Only ignore JWT decode errors, rethrow Redis errors
    if (err instanceof jwt.JsonWebTokenError || err instanceof SyntaxError) {
      logger.warn({ err: (err as Error).message }, 'Token decode error during logout');
    } else {
      throw err;
    }
  }
};

/**
 * Change user password
 */
export const changePassword = async (
  userId: string,
  tenantId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const users = await query<UserWithPassword>(
    'SELECT * FROM users WHERE id = $1 AND tenant_id = $2',
    [userId, tenantId]
  );

  if (users.length === 0) {
    throw new AuthenticationError('User not found');
  }

  const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);
  if (!isValid) {
    throw new AuthenticationError('Current password is incorrect');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, config.apiKeyHashRounds);

  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
    [newPasswordHash, userId, tenantId]
  );

  logger.info({ userId }, 'Password changed');
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string, tenantId: string): Promise<User | null> => {
  const users = await query<User>(
    `SELECT id, tenant_id, email, name, role, is_active, created_at, updated_at
     FROM users WHERE id = $1 AND tenant_id = $2`,
    [userId, tenantId]
  );

  return users[0] || null;
};

/**
 * List users for a tenant
 */
export const listUsers = async (
  tenantId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ users: User[]; total: number }> => {
  const [users, countResult] = await Promise.all([
    query<User>(
      `SELECT id, tenant_id, email, name, role, is_active, created_at, updated_at
       FROM users WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    ),
    query<{ count: string }>(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1',
      [tenantId]
    ),
  ]);

  return {
    users,
    total: parseInt(countResult[0].count, 10),
  };
};
