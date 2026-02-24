import jwt from 'jsonwebtoken';
import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { JwtPayload } from '../types/index.js';
import type { Socket } from 'socket.io';
import type { Request, Response, NextFunction } from 'express';

export interface AuthResult {
  tenantId: string;
  userId?: string;
  apiKeyId?: string;
}

/**
 * Validate API key via auth service HTTP call
 */
const validateApiKeyViaAuthService = async (apiKey: string): Promise<{ tenant_id: string; api_key_id: string }> => {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';
  const response = await axios.post(
    `${authServiceUrl}/internal/validate-api-key`,
    {},
    {
      headers: { 'X-API-Key': apiKey },
      timeout: 5000,
    }
  );
  return { tenant_id: response.data.tenant_id, api_key_id: response.data.api_key_id };
};

export const authenticateSocket = (socket: Socket, next: (err?: Error) => void): void => {
  const token = socket.handshake.auth?.token as string;
  const apiKey = socket.handshake.auth?.apiKey as string;

  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;
      if (payload.type !== 'access') {
        return next(new Error('Invalid token type'));
      }
      (socket as unknown as Record<string, unknown>).authContext = {
        tenantId: payload.tenant_id,
        userId: payload.sub,
      };
      next();
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Socket JWT auth failed');
      next(new Error('Authentication failed'));
    }
  } else if (apiKey) {
    // Validate API key against auth service (async)
    validateApiKeyViaAuthService(apiKey)
      .then((result) => {
        (socket as unknown as Record<string, unknown>).authContext = {
          tenantId: result.tenant_id,
          apiKeyId: result.api_key_id,
        };
        next();
      })
      .catch((err) => {
        logger.warn({ err: (err as Error).message }, 'Socket API key auth failed');
        next(new Error('Invalid API key'));
      });
  } else {
    next(new Error('Authentication required'));
  }
};

export const authenticateHttp = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;
      if (payload.type !== 'access') {
        return next(new Error('Invalid token type'));
      }
      req.context = { tenant_id: payload.tenant_id, user_id: payload.sub };
      next();
    } else {
      next(new Error('Authentication required'));
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'HTTP auth failed');
    next(new Error('Authentication failed'));
  }
};
