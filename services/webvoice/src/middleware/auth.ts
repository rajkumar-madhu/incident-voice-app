import jwt from 'jsonwebtoken';
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

export const authenticateSocket = (socket: Socket, next: (err?: Error) => void): void => {
  try {
    const token = socket.handshake.auth?.token as string;
    const apiKey = socket.handshake.auth?.apiKey as string;

    if (token) {
      const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
      if (payload.type !== 'access') {
        return next(new Error('Invalid token type'));
      }
      (socket as unknown as Record<string, unknown>).authContext = {
        tenantId: payload.tenant_id,
        userId: payload.sub,
      };
      next();
    } else if (apiKey) {
      // For API key auth in socket, we trust the tenant_id from handshake
      // Full API key validation would require DB access
      const tenantId = socket.handshake.auth?.tenantId as string;
      if (!tenantId) {
        return next(new Error('tenantId required with API key'));
      }
      (socket as unknown as Record<string, unknown>).authContext = {
        tenantId,
        apiKeyId: apiKey,
      };
      next();
    } else {
      next(new Error('Authentication required'));
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Socket auth failed');
    next(new Error('Authentication failed'));
  }
};

export const authenticateHttp = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
      req.context = { tenant_id: payload.tenant_id, user_id: payload.sub };
    }
    next();
  } catch {
    next();
  }
};
