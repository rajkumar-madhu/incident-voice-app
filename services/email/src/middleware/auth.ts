import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config.js';
import { authAttemptsTotal } from '../utils/metrics.js';
import { AuthenticationError } from './errorHandler.js';
import { query } from '../db/postgres.js';
import { getRedisClient } from '../db/redis.js';
import type { JwtPayload, ApiKey } from '../types/index.js';

const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const client = await getRedisClient();
    const result = await client.get(`blacklist:${token}`);
    return result !== null;
  } catch {
    return false; // fail-open if Redis unavailable
  }
};

const verifyJwt = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new AuthenticationError('Missing or invalid Authorization header');
    const token = authHeader.substring(7);

    // Check if token has been revoked
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      authAttemptsTotal.inc({ type: 'jwt', status: 'failure' });
      throw new AuthenticationError('Token has been revoked');
    }

    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    }) as JwtPayload;
    if (payload.type !== 'access') throw new AuthenticationError('Invalid token type');
    req.context = { tenant_id: payload.tenant_id, user_id: payload.sub };
    authAttemptsTotal.inc({ type: 'jwt', status: 'success' });
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) { authAttemptsTotal.inc({ type: 'jwt', status: 'failure' }); next(new AuthenticationError('Invalid token')); }
    else if (err instanceof jwt.TokenExpiredError) { authAttemptsTotal.inc({ type: 'jwt', status: 'failure' }); next(new AuthenticationError('Token expired')); }
    else next(err);
  }
};

const verifyApiKey = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) throw new AuthenticationError('Missing X-API-Key header');

    // Parse vsk_<prefix>_<secret> format
    if (!apiKey.startsWith('vsk_')) {
      authAttemptsTotal.inc({ type: 'api_key', status: 'failure' });
      throw new AuthenticationError('Invalid API key format');
    }
    const secondUnderscoreIdx = apiKey.indexOf('_', 4);
    if (secondUnderscoreIdx === -1) {
      authAttemptsTotal.inc({ type: 'api_key', status: 'failure' });
      throw new AuthenticationError('Invalid API key format');
    }
    const prefix = apiKey.substring(0, secondUnderscoreIdx);

    const keys = await query<ApiKey>('SELECT id, tenant_id, key_hash, scopes, is_active, expires_at FROM api_keys WHERE key_prefix = $1 AND is_active = true', [prefix]);
    if (keys.length === 0) { authAttemptsTotal.inc({ type: 'api_key', status: 'failure' }); throw new AuthenticationError('Invalid API key'); }
    const keyRecord = keys[0];
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) { authAttemptsTotal.inc({ type: 'api_key', status: 'failure' }); throw new AuthenticationError('API key expired'); }
    const isValid = await bcrypt.compare(apiKey, keyRecord.key_hash);
    if (!isValid) { authAttemptsTotal.inc({ type: 'api_key', status: 'failure' }); throw new AuthenticationError('Invalid API key'); }
    await query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [keyRecord.id]);
    req.context = { tenant_id: keyRecord.tenant_id, api_key_id: keyRecord.id, scopes: keyRecord.scopes };
    authAttemptsTotal.inc({ type: 'api_key', status: 'success' });
    next();
  } catch (err) { next(err); }
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const hasJwt = req.headers.authorization?.startsWith('Bearer ');
  const hasApiKey = !!req.headers['x-api-key'];
  if (hasJwt) return verifyJwt(req, res, next);
  else if (hasApiKey) return verifyApiKey(req, res, next);
  else next(new AuthenticationError('Authentication required'));
};
