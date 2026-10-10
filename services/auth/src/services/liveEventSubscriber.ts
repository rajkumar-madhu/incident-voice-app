import { createClient, RedisClientType } from 'redis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { getClient } from '../db/postgres.js';

const LIVE_EVENT_CHANNEL = 'call:live';
const TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;

let subscriberClient: RedisClientType | null = null;

interface LiveCallEvent {
  event: 'call.started' | 'call.transcribed' | 'call.responded';
  session_id: string;
  tenant_id: string;
  agent_id?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Dispatch live event to all agents for a tenant that subscribe to this event type.
 */
const dispatchLiveWebhook = async (event: LiveCallEvent): Promise<void> => {
  const client = await getClient();
  try {
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [event.tenant_id]);

    // Find all agents for this tenant with matching webhook events
    const result = await client.query(
      `SELECT id, name, webhook_url, webhook_events, webhook_secret
       FROM agents
       WHERE tenant_id = $1 AND webhook_url IS NOT NULL AND is_active = true`,
      [event.tenant_id]
    );

    for (const agent of result.rows) {
      const events: string[] = agent.webhook_events || [];
      if (events.length > 0 && !events.includes(event.event)) continue;

      const payload = {
        event: event.event,
        timestamp: event.timestamp,
        agent: { id: agent.id, name: agent.name },
        session_id: event.session_id,
        data: event.data,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event.event,
      };
      if (agent.webhook_secret) {
        headers['X-API-Key'] = agent.webhook_secret;
      }

      // Fire-and-forget with minimal retry for live events (speed matters)
      sendLiveWebhook(agent.webhook_url, payload, headers).catch(err =>
        logger.warn({ err, agentId: agent.id, event: event.event }, 'Live webhook delivery failed')
      );
    }
  } catch (err) {
    logger.error({ err, event: event.event }, 'Failed to dispatch live webhook');
  } finally {
    client.release();
  }
};

const sendLiveWebhook = async (
  url: string,
  payload: Record<string, unknown>,
  headers: Record<string, string>
): Promise<void> => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        logger.debug({ url, event: payload.event }, 'Live webhook delivered');
        return;
      }
    } catch {
      // Retry silently
    }

    if (attempt < MAX_RETRIES - 1) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }
};

export const startLiveEventSubscriber = async (): Promise<void> => {
  try {
    subscriberClient = createClient({ url: config.redisUrl });

    subscriberClient.on('error', (err) => {
      logger.error({ err }, 'Live event subscriber Redis error');
    });

    await subscriberClient.connect();

    await subscriberClient.subscribe(LIVE_EVENT_CHANNEL, async (message) => {
      try {
        const event = JSON.parse(message) as LiveCallEvent;
        await dispatchLiveWebhook(event);
      } catch (err) {
        logger.error({ err }, 'Failed to process live event');
      }
    });

    logger.info('Live event subscriber started');
  } catch (err) {
    logger.error({ err }, 'Failed to start live event subscriber');
  }
};

export const stopLiveEventSubscriber = async (): Promise<void> => {
  if (subscriberClient && subscriberClient.isOpen) {
    await subscriberClient.unsubscribe(LIVE_EVENT_CHANNEL);
    await subscriberClient.quit();
    logger.info('Live event subscriber stopped');
  }
};
