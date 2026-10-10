import { getRedisClient } from '../db/redis.js';
import { logger } from '../utils/logger.js';

const LIVE_EVENT_CHANNEL = 'call:live';

export interface LiveCallEvent {
  event: 'call.started' | 'call.transcribed' | 'call.responded';
  session_id: string;
  tenant_id: string;
  agent_id?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export const publishLiveEvent = async (event: LiveCallEvent): Promise<void> => {
  try {
    const client = await getRedisClient();
    await client.publish(LIVE_EVENT_CHANNEL, JSON.stringify(event));
  } catch (err) {
    logger.error({ err, event: event.event, sessionId: event.session_id }, 'Failed to publish live event');
  }
};
