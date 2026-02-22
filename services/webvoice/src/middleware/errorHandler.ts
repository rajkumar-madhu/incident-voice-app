import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { httpRequestsTotal, httpRequestDuration } from '../utils/metrics.js';

export class AppError extends Error {
  constructor(public statusCode: number, public message: string, public code?: string, public details?: unknown) {
    super(message); this.name = 'AppError'; Error.captureStackTrace(this, this.constructor);
  }
}
export class NotFoundError extends AppError { constructor(resource: string = 'Resource') { super(404, `${resource} not found`, 'NOT_FOUND'); } }

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string;
  const duration = req.startTime ? (Date.now() - req.startTime) / 1000 : 0;
  let statusCode = 500, code = 'INTERNAL_ERROR', message = 'An unexpected error occurred';

  if (err instanceof AppError) { statusCode = err.statusCode; code = err.code || 'ERROR'; message = err.message; }

  if (statusCode >= 500) logger.error({ err, statusCode, requestId, method: req.method, path: req.path }, message);
  else logger.warn({ statusCode, requestId, method: req.method, path: req.path }, message);

  httpRequestsTotal.inc({ method: req.method, path: req.route?.path || req.path, status: statusCode });
  httpRequestDuration.observe({ method: req.method, path: req.route?.path || req.path, status: statusCode }, duration);

  res.status(statusCode).json({ error: { code, message }, ...(requestId ? { requestId } : {}) });
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError('Endpoint'));
};
