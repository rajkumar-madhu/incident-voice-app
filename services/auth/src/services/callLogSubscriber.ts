import { createClient, RedisClientType } from 'redis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { insertCallLog } from './callLogService.js';
import { dispatchWebhook } from './webhookService.js';
import { CallCompletedEventSchema } from '../types/dashboard.js';
import type { CallLog } from '../types/dashboard.js';

const CALL_COMPLETED_CHANNEL = 'call:completed';

let subscriberClient: RedisClientType | null = null;

/**
 * Classify call transcript into ITSM category (incident / problem / change).
 * Uses keyword heuristics; can be replaced with LLM classification.
 */
const classifyItsmType = (callLog: CallLog): { type: 'incident' | 'problem' | 'change'; priority: 'critical' | 'high' | 'medium' | 'low'; category: string } | null => {
  const text = (callLog.transcript_summary || '').toLowerCase();
  const meta = callLog.metadata || {};
  const tags = (meta.tags as string[]) || [];

  // Incident detection: outage, down, broken, error, not working, urgent
  const incidentKeywords = ['outage', 'down', 'broken', 'error', 'not working', 'crash', 'urgent', 'emergency', 'failed', 'offline', 'unavailable'];
  if (incidentKeywords.some(kw => text.includes(kw)) || tags.includes('incident')) {
    const isCritical = ['outage', 'emergency', 'crash', 'offline'].some(kw => text.includes(kw));
    return {
      type: 'incident',
      priority: isCritical ? 'critical' : 'high',
      category: 'service_disruption',
    };
  }

  // Change request detection: change, update, upgrade, modify, add, new feature, request
  const changeKeywords = ['change request', 'need to change', 'please update', 'upgrade', 'modify', 'new feature', 'add feature', 'request access', 'enable', 'provision'];
  if (changeKeywords.some(kw => text.includes(kw)) || tags.includes('change')) {
    return {
      type: 'change',
      priority: 'medium',
      category: 'change_request',
    };
  }

  // Problem detection: recurring, keeps happening, always, pattern, multiple times, root cause
  const problemKeywords = ['recurring', 'keeps happening', 'always', 'pattern', 'multiple times', 'root cause', 'intermittent', 'sometimes fails', 'every time'];
  if (problemKeywords.some(kw => text.includes(kw)) || tags.includes('problem')) {
    return {
      type: 'problem',
      priority: 'medium',
      category: 'recurring_issue',
    };
  }

  return null;
};

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

        if (!event.agent_id) return;

        // 1. Fire call status webhook (non-blocking)
        const callEventType = event.status === 'failed' ? 'call.failed'
          : event.status === 'abandoned' ? 'call.abandoned'
          : 'call.completed';
        dispatchWebhook(event.agent_id, event.tenant_id, callEventType, callLog)
          .catch(err => logger.error({ err }, 'Webhook dispatch failed'));

        // 2. ITSM classification — fire incident/problem/change webhook
        const itsm = classifyItsmType(callLog);
        if (itsm) {
          const itsmEvent = itsm.type === 'incident' ? 'incident.created'
            : itsm.type === 'change' ? 'change.requested'
            : 'problem.created';

          logger.info({ sessionId: callLog.session_id, itsmType: itsm.type, priority: itsm.priority }, 'ITSM event classified');

          dispatchWebhook(event.agent_id, event.tenant_id, itsmEvent, callLog, {
            type: itsm.type,
            priority: itsm.priority,
            category: itsm.category,
            summary: callLog.transcript_summary || `${itsm.type} reported via voice call`,
          }).catch(err => logger.error({ err }, 'ITSM webhook dispatch failed'));
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
