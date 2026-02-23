import { createClient, RedisClientType } from 'redis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { insertCallLog } from './callLogService.js';
import { dispatchWebhook } from './webhookService.js';
import { CallCompletedEventSchema } from '../types/dashboard.js';

const CALL_COMPLETED_CHANNEL = 'call:completed';

let subscriberClient: RedisClientType | null = null;

export const startCallLogSubscriber = async (): Promise<void> => {
  try {
    subscriberClient = createClient({ url: config.redisUrl });

    subscriberClient.on('error', (err) => {
      logger.error({ err }, 'Call log subscriber Redis error');
    });

    await subscriberClient.connect();

    await subscriberClient.subscribe(CALL_COMPLETED_CHANNEL, async (message) => {
      try {
        const raw = JSON.parse(message);
        const event = CallCompletedEventSchema.parse(raw);
        const callLog = await insertCallLog(event);

        // Fire webhook (non-blocking)
        if (event.agent_id) {
          const eventType = event.status === 'failed' ? 'call.failed'
            : event.status === 'abandoned' ? 'call.abandoned'
            : 'call.completed';
          dispatchWebhook(event.agent_id, event.tenant_id, eventType, callLog)
            .catch(err => logger.error({ err }, 'Webhook dispatch failed'));
        }
      } catch (err) {
        logger.error({ err, message }, 'Failed to process call completed event');
      }
    });

    logger.info('Call log subscriber started');
  } catch (err) {
    logger.error({ err }, 'Failed to start call log subscriber');
  }
};

export const stopCallLogSubscriber = async (): Promise<void> => {
  if (subscriberClient && subscriberClient.isOpen) {
    await subscriberClient.unsubscribe(CALL_COMPLETED_CHANNEL);
    await subscriberClient.quit();
    logger.info('Call log subscriber stopped');
  }
};
