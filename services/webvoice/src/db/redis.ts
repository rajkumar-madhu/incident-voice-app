import { createClient, RedisClientType } from 'redis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let redisClient: RedisClientType | null = null;

export const getRedisClient = async (): Promise<RedisClientType> => {
  if (redisClient && redisClient.isOpen) return redisClient;
  redisClient = createClient({ url: config.redisUrl });
  redisClient.on('error', (err) => { logger.error({ err }, 'Redis client error'); });
  redisClient.on('connect', () => { logger.info('Connected to Redis'); });
  redisClient.on('reconnecting', () => { logger.warn('Reconnecting to Redis'); });
  await redisClient.connect();
  return redisClient;
};

export const checkRedisConnection = async (): Promise<boolean> => {
  try { const client = await getRedisClient(); await client.ping(); return true; } catch { return false; }
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient && redisClient.isOpen) { await redisClient.quit(); logger.info('Redis connection closed'); }
};
