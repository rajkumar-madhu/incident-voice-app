import { getClient } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import type { CallLog } from '../types/dashboard.js';

interface AgentWebhookConfig {
  id: string;
  name: string;
  webhook_url: string | null;
  webhook_events: string[];
  webhook_secret: string | null;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  agent: {
    id: string;
    name: string;
  };
  call: {
    session_id: string;
    conversation_id: string | null;
    channel: string;
    direction: string;
    status: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number;
    turn_count: number;
    transcript_summary: string | null;
    user_sentiment: string | null;
    caller_number: string | null;
  };
  latency: {
    stt_ms: number | null;
    llm_ms: number | null;
    tts_ms: number | null;
    total_ms: number | null;
  };
  metadata: Record<string, unknown>;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const TIMEOUT_MS = 5000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const buildPayload = (
  agent: AgentWebhookConfig,
  event: string,
  callLog: CallLog
): WebhookPayload => ({
  event,
  timestamp: new Date().toISOString(),
  agent: {
    id: agent.id,
    name: agent.name,
  },
  call: {
    session_id: callLog.session_id,
    conversation_id: callLog.conversation_id,
    channel: callLog.channel,
    direction: callLog.direction,
    status: callLog.status,
    started_at: callLog.started_at instanceof Date
      ? callLog.started_at.toISOString()
      : String(callLog.started_at),
    ended_at: callLog.ended_at instanceof Date
      ? callLog.ended_at.toISOString()
      : callLog.ended_at ? String(callLog.ended_at) : null,
    duration_seconds: Number(callLog.duration_seconds),
    turn_count: callLog.turn_count,
    transcript_summary: callLog.transcript_summary,
    user_sentiment: callLog.user_sentiment,
    caller_number: callLog.caller_number,
  },
  latency: {
    stt_ms: callLog.stt_latency_ms,
    llm_ms: callLog.llm_latency_ms,
    tts_ms: callLog.tts_latency_ms,
    total_ms: callLog.total_latency_ms,
  },
  metadata: callLog.metadata,
});

const sendWithRetry = async (
  url: string,
  payload: WebhookPayload,
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
        logger.info(
          { url, event: payload.event, status: response.status, attempt: attempt + 1 },
          'Webhook delivered'
        );
        return;
      }

      logger.warn(
        { url, event: payload.event, status: response.status, attempt: attempt + 1 },
        'Webhook delivery failed with non-OK status'
      );
    } catch (err) {
      logger.warn(
        { err, url, event: payload.event, attempt: attempt + 1 },
        'Webhook delivery attempt failed'
      );
    }

    if (attempt < MAX_RETRIES - 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  logger.error(
    { url, event: payload.event, maxRetries: MAX_RETRIES },
    'Webhook delivery exhausted all retries'
  );
};

export const dispatchWebhook = async (
  agentId: string,
  tenantId: string,
  event: string,
  callLog: CallLog
): Promise<void> => {
  const client = await getClient();
  try {
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    const result = await client.query(
      'SELECT id, name, webhook_url, webhook_events, webhook_secret FROM agents WHERE id = $1 AND tenant_id = $2',
      [agentId, tenantId]
    );

    if (result.rows.length === 0) {
      logger.warn({ agentId, tenantId }, 'Webhook dispatch: agent not found');
      return;
    }

    const agent = result.rows[0] as AgentWebhookConfig;

    if (!agent.webhook_url) {
      return;
    }

    const events = agent.webhook_events || [];
    if (events.length > 0 && !events.includes(event)) {
      logger.debug({ agentId, event, configuredEvents: events }, 'Webhook event not in configured events');
      return;
    }

    const payload = buildPayload(agent, event, callLog);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
    };

    if (agent.webhook_secret) {
      headers['X-API-Key'] = agent.webhook_secret;
    }

    await sendWithRetry(agent.webhook_url, payload, headers);
  } catch (err) {
    logger.error({ err, agentId, tenantId, event }, 'Webhook dispatch unexpected error');
  } finally {
    client.release();
  }
};
