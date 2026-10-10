import { createClient, RedisClientType } from 'redis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const CALL_COMPLETED_CHANNEL = 'call:completed';

let redisClient: RedisClientType | null = null;

const getClient = async (): Promise<RedisClientType> => {
  if (!redisClient || !redisClient.isOpen) {
    redisClient = createClient({ url: config.redisUrl });
    redisClient.on('error', (err) => logger.error({ err }, 'Call event publisher Redis error'));
    await redisClient.connect();
  }
  return redisClient;
};

export interface TwilioCallEvent {
  session_id: string;
  tenant_id: string;
  conversation_id?: string;
  agent_id?: string;
  channel: 'twilio';
  direction: 'inbound' | 'outbound';
  status: 'completed' | 'failed' | 'abandoned' | 'no_answer' | 'busy';
  caller_number?: string;
  callee_number?: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  stt_latency_ms?: number;
  llm_latency_ms?: number;
  tts_latency_ms?: number;
  stt_seconds: number;
  tts_characters: number;
  llm_tokens: number;
  turn_count: number;
  total_cost_cents: number;
  transcript_summary?: string;
  user_sentiment?: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export const publishTwilioCallEvent = async (event: TwilioCallEvent): Promise<void> => {
  try {
    const client = await getClient();
    await client.publish(CALL_COMPLETED_CHANNEL, JSON.stringify(event));
    logger.info({ sessionId: event.session_id, status: event.status }, 'Twilio call event published');
  } catch (err) {
    logger.error({ err, sessionId: event.session_id }, 'Failed to publish Twilio call event');
  }
};

export const closeCallEventPublisher = async (): Promise<void> => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
};
