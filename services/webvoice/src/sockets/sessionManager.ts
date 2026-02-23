import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from '../db/redis.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { activeSessions, sessionDuration } from '../utils/metrics.js';
import { publishCallCompleted } from '../services/callLogPublisher.js';
import type { VoiceSession } from '../types/index.js';

const SESSION_PREFIX = 'voicesession:';

export const createSession = async (tenantId: string, userId?: string, apiKeyId?: string): Promise<VoiceSession> => {
  const session: VoiceSession = {
    id: uuidv4(),
    tenantId,
    userId,
    apiKeyId,
    status: 'active',
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    metadata: {},
  };

  const client = await getRedisClient();
  await client.setEx(
    `${SESSION_PREFIX}${session.id}`,
    Math.ceil(config.maxSessionDurationMs / 1000),
    JSON.stringify(session)
  );

  activeSessions.inc();
  logger.info({ sessionId: session.id, tenantId }, 'Voice session created');
  return session;
};

export const getSession = async (sessionId: string): Promise<VoiceSession | null> => {
  const client = await getRedisClient();
  const data = await client.get(`${SESSION_PREFIX}${sessionId}`);
  return data ? JSON.parse(data) : null;
};

export const updateSessionActivity = async (sessionId: string): Promise<void> => {
  const session = await getSession(sessionId);
  if (!session) return;

  session.lastActivityAt = Date.now();
  const client = await getRedisClient();
  const ttl = Math.ceil((config.maxSessionDurationMs - (Date.now() - session.createdAt)) / 1000);
  if (ttl > 0) {
    await client.setEx(`${SESSION_PREFIX}${sessionId}`, ttl, JSON.stringify(session));
  }
};

export const destroySession = async (sessionId: string, status: string = 'completed'): Promise<void> => {
  const session = await getSession(sessionId);

  // Publish call completed event before deleting session data
  if (session) {
    await publishCallCompleted(session, status);
  }

  const client = await getRedisClient();
  await client.del(`${SESSION_PREFIX}${sessionId}`);

  activeSessions.dec();
  if (session) {
    const duration = (Date.now() - session.createdAt) / 1000;
    sessionDuration.observe(duration);
    logger.info({ sessionId, tenantId: session.tenantId, duration: Math.round(duration) }, 'Voice session destroyed');
  }
};

export const isSessionExpired = (session: VoiceSession): boolean => {
  const now = Date.now();
  const idleExpired = (now - session.lastActivityAt) > config.sessionTimeoutMs;
  const maxExpired = (now - session.createdAt) > config.maxSessionDurationMs;
  return idleExpired || maxExpired;
};
