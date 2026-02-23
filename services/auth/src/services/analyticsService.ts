import { query } from '../db/postgres.js';
import type { AnalyticsQuery, DailyCallStat, HeatmapCell, AgentPerformance } from '../types/dashboard.js';

export const getCallsOverTime = async (
  tenantId: string,
  params: AnalyticsQuery
): Promise<DailyCallStat[]> => {
  const dateFrom = params.date_from || new Date(Date.now() - 30 * 86400000).toISOString();
  const dateTo = params.date_to || new Date().toISOString();

  let intervalTrunc: string;
  switch (params.interval) {
    case 'hour': intervalTrunc = 'hour'; break;
    case 'week': intervalTrunc = 'week'; break;
    default: intervalTrunc = 'day';
  }

  const conditions = ['tenant_id = $1', 'started_at >= $2', 'started_at <= $3'];
  const values: unknown[] = [tenantId, dateFrom, dateTo];

  if (params.agent_id) {
    conditions.push('agent_id = $4');
    values.push(params.agent_id);
  }

  const whereClause = conditions.join(' AND ');

  return query<DailyCallStat>(
    `SELECT
      DATE_TRUNC('${intervalTrunc}', started_at)::text AS call_date,
      COUNT(*)::int AS total_calls,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_calls,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_calls,
      COUNT(*) FILTER (WHERE status = 'abandoned')::int AS abandoned_calls,
      COALESCE(AVG(duration_seconds), 0)::float AS avg_duration,
      COALESCE(SUM(duration_seconds), 0)::float AS total_duration,
      COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_seconds), 0)::float AS p50_duration,
      COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_seconds), 0)::float AS p95_duration,
      COALESCE(AVG(stt_latency_ms), 0)::float AS avg_stt_latency,
      COALESCE(AVG(llm_latency_ms), 0)::float AS avg_llm_latency,
      COALESCE(AVG(tts_latency_ms), 0)::float AS avg_tts_latency,
      COALESCE(SUM(total_cost_cents), 0)::float AS total_cost_cents,
      COUNT(*) FILTER (WHERE channel = 'web')::int AS web_calls,
      COUNT(*) FILTER (WHERE channel = 'twilio')::int AS twilio_calls,
      COUNT(*) FILTER (WHERE channel = 'api')::int AS api_calls,
      COUNT(*) FILTER (WHERE channel = 'widget')::int AS widget_calls,
      COUNT(*) FILTER (WHERE user_sentiment = 'positive')::int AS positive_sentiment,
      COUNT(*) FILTER (WHERE user_sentiment = 'negative')::int AS negative_sentiment,
      COUNT(*) FILTER (WHERE user_sentiment = 'neutral')::int AS neutral_sentiment
    FROM call_logs
    WHERE ${whereClause}
    GROUP BY DATE_TRUNC('${intervalTrunc}', started_at)
    ORDER BY call_date ASC`,
    values
  );
};

export const getCostOverTime = async (
  tenantId: string,
  params: AnalyticsQuery
): Promise<{ date: string; stt_cost: number; llm_cost: number; tts_cost: number; total_cost: number }[]> => {
  const dateFrom = params.date_from || new Date(Date.now() - 30 * 86400000).toISOString();
  const dateTo = params.date_to || new Date().toISOString();

  return query(
    `SELECT
      DATE_TRUNC('day', started_at)::text AS date,
      COALESCE(SUM(stt_seconds * 0.004), 0)::float AS stt_cost,
      COALESCE(SUM(llm_tokens * 0.003 / 1000), 0)::float AS llm_cost,
      COALESCE(SUM(tts_characters * 0.0015 / 1000), 0)::float AS tts_cost,
      COALESCE(SUM(total_cost_cents), 0)::float AS total_cost
    FROM call_logs
    WHERE tenant_id = $1 AND started_at >= $2 AND started_at <= $3
    GROUP BY DATE_TRUNC('day', started_at)
    ORDER BY date ASC`,
    [tenantId, dateFrom, dateTo]
  );
};

export const getLatencyPercentiles = async (
  tenantId: string,
  params: AnalyticsQuery
): Promise<unknown[]> => {
  const dateFrom = params.date_from || new Date(Date.now() - 30 * 86400000).toISOString();
  const dateTo = params.date_to || new Date().toISOString();

  return query(
    `SELECT
      DATE_TRUNC('day', started_at)::text AS date,
      COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_latency_ms), 0)::float AS p50,
      COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_latency_ms), 0)::float AS p75,
      COALESCE(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_latency_ms), 0)::float AS p90,
      COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms), 0)::float AS p95,
      COALESCE(AVG(stt_latency_ms), 0)::float AS avg_stt,
      COALESCE(AVG(llm_latency_ms), 0)::float AS avg_llm,
      COALESCE(AVG(tts_latency_ms), 0)::float AS avg_tts
    FROM call_logs
    WHERE tenant_id = $1 AND started_at >= $2 AND started_at <= $3
      AND total_latency_ms IS NOT NULL
    GROUP BY DATE_TRUNC('day', started_at)
    ORDER BY date ASC`,
    [tenantId, dateFrom, dateTo]
  );
};

export const getAgentPerformance = async (
  tenantId: string,
  params: AnalyticsQuery
): Promise<AgentPerformance[]> => {
  const dateFrom = params.date_from || new Date(Date.now() - 30 * 86400000).toISOString();
  const dateTo = params.date_to || new Date().toISOString();

  return query<AgentPerformance>(
    `SELECT
      a.id AS agent_id,
      a.name AS agent_name,
      COUNT(c.id)::int AS total_calls,
      COUNT(c.id) FILTER (WHERE c.status = 'completed')::int AS completed_calls,
      CASE WHEN COUNT(c.id) > 0
        THEN (COUNT(c.id) FILTER (WHERE c.status = 'completed')::float / COUNT(c.id)::float * 100)
        ELSE 0 END AS success_rate,
      COALESCE(AVG(c.duration_seconds), 0)::float AS avg_duration,
      COALESCE(AVG(c.total_latency_ms), 0)::float AS avg_latency,
      COALESCE(SUM(c.total_cost_cents), 0)::float AS total_cost_cents
    FROM agents a
    LEFT JOIN call_logs c ON c.agent_id = a.id
      AND c.started_at >= $2 AND c.started_at <= $3
    WHERE a.tenant_id = $1 AND a.is_active = true
    GROUP BY a.id, a.name
    ORDER BY total_calls DESC`,
    [tenantId, dateFrom, dateTo]
  );
};

export const getCallHeatmap = async (tenantId: string): Promise<HeatmapCell[]> => {
  return query<HeatmapCell>(
    `SELECT day_of_week, hour_of_day, call_count::int, avg_duration::float
     FROM mv_hourly_call_volume
     WHERE tenant_id = $1`,
    [tenantId]
  );
};
