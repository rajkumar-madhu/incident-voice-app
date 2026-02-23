import { getRedisClient } from '../db/redis.js';
import { logger } from '../utils/logger.js';
import type { VoiceSession } from '../types/index.js';

const CALL_COMPLETED_CHANNEL = 'call:completed';

export interface CallCompletedPayload {
  session_id: string;
  tenant_id: string;
  conversation_id?: string;
  agent_id?: string;
  channel: string;
  direction: string;
  status: string;
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

export const publishCallCompleted = async (
  session: VoiceSession,
  status: string = 'completed'
): Promise<void> => {
  try {
    const client = await getRedisClient();
    const duration = (Date.now() - session.createdAt) / 1000;

    const payload: CallCompletedPayload = {
      session_id: session.id,
      tenant_id: session.tenantId,
      conversation_id: session.metadata?.conversationId as string | undefined,
      agent_id: session.metadata?.agentId as string | undefined,
      channel: (session.metadata?.channel as string) || 'web',
      direction: 'inbound',
      status,
      started_at: new Date(session.createdAt).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: Math.round(duration * 100) / 100,
      stt_latency_ms: session.metadata?.sttLatencyMs as number | undefined,
      llm_latency_ms: session.metadata?.llmLatencyMs as number | undefined,
      tts_latency_ms: session.metadata?.ttsLatencyMs as number | undefined,
      stt_seconds: (session.metadata?.sttSeconds as number) || 0,
      tts_characters: (session.metadata?.ttsCharacters as number) || 0,
      llm_tokens: (session.metadata?.llmTokens as number) || 0,
      turn_count: (session.metadata?.turnCount as number) || 0,
      total_cost_cents: (session.metadata?.totalCostCents as number) || 0,
      transcript_summary: session.metadata?.transcriptSummary as string | undefined,
      user_sentiment: session.metadata?.userSentiment as string | undefined,
      tags: (session.metadata?.tags as string[]) || [],
      metadata: {},
    };

    await client.publish(CALL_COMPLETED_CHANNEL, JSON.stringify(payload));
    logger.info({ sessionId: session.id, tenantId: session.tenantId }, 'Call completed event published');
  } catch (err) {
    logger.error({ err, sessionId: session.id }, 'Failed to publish call completed event');
  }
};
