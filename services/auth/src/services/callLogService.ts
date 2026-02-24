import { query } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { CallLog, CallLogFilter, CallCompletedEvent, PaginatedResponse } from '../types/dashboard.js';

export const insertCallLog = async (event: CallCompletedEvent): Promise<CallLog> => {
  const logs = await query<CallLog>(
    `INSERT INTO call_logs (
      tenant_id, session_id, conversation_id, agent_id, channel, direction,
      status, caller_number, callee_number, started_at, ended_at,
      duration_seconds, stt_latency_ms, llm_latency_ms, tts_latency_ms,
      total_latency_ms, stt_seconds, tts_characters, llm_tokens, turn_count,
      total_cost_cents, transcript_summary, user_sentiment, tags,
      recording_url, metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
    ) RETURNING *`,
    [
      event.tenant_id, event.session_id, event.conversation_id || null,
      event.agent_id || null, event.channel, event.direction, event.status,
      event.caller_number || null, event.callee_number || null,
      event.started_at, event.ended_at, event.duration_seconds,
      event.stt_latency_ms || null, event.llm_latency_ms || null,
      event.tts_latency_ms || null,
      (event.stt_latency_ms || 0) + (event.llm_latency_ms || 0) + (event.tts_latency_ms || 0) || null,
      event.stt_seconds, event.tts_characters, event.llm_tokens, event.turn_count,
      event.total_cost_cents, event.transcript_summary || null,
      event.user_sentiment || null, event.tags,
      event.recording_url || null, JSON.stringify(event.metadata),
    ]
  );

  logger.info({ sessionId: event.session_id, tenantId: event.tenant_id }, 'Call log inserted');
  return logs[0];
};

export const listCallLogs = async (
  tenantId: string,
  filters: CallLogFilter
): Promise<PaginatedResponse<CallLog>> => {
  const conditions: string[] = ['tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let paramIndex = 2;

  if (filters.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.channel) {
    conditions.push(`channel = $${paramIndex}`);
    params.push(filters.channel);
    paramIndex++;
  }

  if (filters.agent_id) {
    conditions.push(`agent_id = $${paramIndex}`);
    params.push(filters.agent_id);
    paramIndex++;
  }

  if (filters.direction) {
    conditions.push(`direction = $${paramIndex}`);
    params.push(filters.direction);
    paramIndex++;
  }

  if (filters.sentiment) {
    conditions.push(`user_sentiment = $${paramIndex}`);
    params.push(filters.sentiment);
    paramIndex++;
  }

  if (filters.date_from) {
    conditions.push(`started_at >= $${paramIndex}`);
    params.push(filters.date_from);
    paramIndex++;
  }

  if (filters.date_to) {
    conditions.push(`started_at <= $${paramIndex}`);
    params.push(filters.date_to);
    paramIndex++;
  }

  if (filters.duration_min !== undefined) {
    conditions.push(`duration_seconds >= $${paramIndex}`);
    params.push(filters.duration_min);
    paramIndex++;
  }

  if (filters.duration_max !== undefined) {
    conditions.push(`duration_seconds <= $${paramIndex}`);
    params.push(filters.duration_max);
    paramIndex++;
  }

  if (filters.search) {
    conditions.push(`to_tsvector('english', COALESCE(transcript_summary, '')) @@ plainto_tsquery('english', $${paramIndex})`);
    params.push(filters.search);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const orderClause = `${filters.sort_by} ${filters.sort_order}`;
  const offset = (filters.page - 1) * filters.limit;

  const [data, countResult] = await Promise.all([
    query<CallLog>(
      `SELECT * FROM call_logs WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, filters.limit, offset]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM call_logs WHERE ${whereClause}`,
      params
    ),
  ]);

  const total = parseInt(countResult[0].count, 10);

  return {
    data,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: Math.ceil(total / filters.limit),
    },
  };
};

export const getCallLogById = async (
  callLogId: string,
  tenantId: string
): Promise<CallLog & { transcript?: unknown[] }> => {
  const logs = await query<CallLog>(
    'SELECT * FROM call_logs WHERE id = $1 AND tenant_id = $2',
    [callLogId, tenantId]
  );

  if (logs.length === 0) {
    throw new NotFoundError('Call log');
  }

  const callLog = logs[0];

  let transcript: unknown[] = [];
  if (callLog.conversation_id) {
    transcript = await query(
      `SELECT role, content, created_at
       FROM conversation_messages
       WHERE conversation_id = $1 AND tenant_id = $2
       ORDER BY created_at ASC`,
      [callLog.conversation_id, tenantId]
    );
  }

  return { ...callLog, transcript };
};
