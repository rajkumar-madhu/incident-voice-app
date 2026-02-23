import { query } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { BillingPlan, BillingUsageSummary, CurrentPeriodBilling, CostBreakdownItem } from '../types/dashboard.js';

export const getTenantPlan = async (tenantId: string): Promise<BillingPlan> => {
  const plans = await query<BillingPlan>(
    `SELECT bp.* FROM billing_plans bp
     JOIN tenants t ON t.plan = bp.id
     WHERE t.id = $1`,
    [tenantId]
  );

  if (plans.length === 0) {
    throw new NotFoundError('Billing plan');
  }

  return plans[0];
};

export const getCurrentPeriodSummary = async (tenantId: string): Promise<BillingUsageSummary | null> => {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const summaries = await query<BillingUsageSummary>(
    `SELECT * FROM billing_usage_summaries
     WHERE tenant_id = $1 AND period_start = $2`,
    [tenantId, periodStart.toISOString().split('T')[0]]
  );

  if (summaries.length > 0) {
    return summaries[0];
  }

  // Create current period summary from call_logs if it doesn't exist
  const aggregated = await query<{
    total_call_minutes: number;
    total_stt_seconds: number;
    total_tts_characters: number;
    total_llm_tokens: number;
    total_calls: number;
    total_cost_cents: number;
  }>(
    `SELECT
      COALESCE(SUM(duration_seconds) / 60, 0)::float AS total_call_minutes,
      COALESCE(SUM(stt_seconds), 0)::float AS total_stt_seconds,
      COALESCE(SUM(tts_characters), 0)::int AS total_tts_characters,
      COALESCE(SUM(llm_tokens), 0)::int AS total_llm_tokens,
      COUNT(*)::int AS total_calls,
      COALESCE(SUM(total_cost_cents), 0)::float AS total_cost_cents
    FROM call_logs
    WHERE tenant_id = $1 AND started_at >= $2`,
    [tenantId, periodStart.toISOString()]
  );

  const agg = aggregated[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Count API calls from usage_events
  const apiCallsResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM usage_events
     WHERE tenant_id = $1 AND event_type = 'api_call' AND created_at >= $2`,
    [tenantId, periodStart.toISOString()]
  );
  const totalApiCalls = parseInt(apiCallsResult[0]?.count || '0', 10);

  const inserted = await query<BillingUsageSummary>(
    `INSERT INTO billing_usage_summaries (
      tenant_id, period_start, period_end,
      total_call_minutes, total_stt_seconds, total_tts_characters,
      total_llm_tokens, total_api_calls, total_calls,
      base_cost_cents, overage_cost_cents, total_cost_cents
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, $10)
    ON CONFLICT (tenant_id, period_start) DO UPDATE SET
      total_call_minutes = EXCLUDED.total_call_minutes,
      total_stt_seconds = EXCLUDED.total_stt_seconds,
      total_tts_characters = EXCLUDED.total_tts_characters,
      total_llm_tokens = EXCLUDED.total_llm_tokens,
      total_api_calls = EXCLUDED.total_api_calls,
      total_calls = EXCLUDED.total_calls,
      total_cost_cents = EXCLUDED.total_cost_cents
    RETURNING *`,
    [
      tenantId,
      periodStart.toISOString().split('T')[0],
      periodEnd.toISOString().split('T')[0],
      agg.total_call_minutes, agg.total_stt_seconds,
      agg.total_tts_characters, agg.total_llm_tokens,
      totalApiCalls, agg.total_calls, agg.total_cost_cents,
    ]
  );

  return inserted[0];
};

export const getCurrentPeriodBilling = async (tenantId: string): Promise<CurrentPeriodBilling> => {
  const plan = await getTenantPlan(tenantId);
  const usage = await getCurrentPeriodSummary(tenantId);

  if (!usage) {
    throw new NotFoundError('Usage summary');
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const daysRemaining = daysInMonth - daysPassed;
  const dailyRate = Number(usage.total_cost_cents) / Math.max(daysPassed, 1);
  const projectedCost = dailyRate * daysInMonth;

  return {
    plan,
    usage,
    projected_end_of_month_cost_cents: Math.round(projectedCost * 100) / 100,
    days_remaining: daysRemaining,
  };
};

export const getCostBreakdown = async (tenantId: string): Promise<CostBreakdownItem[]> => {
  const plan = await getTenantPlan(tenantId);
  const usage = await getCurrentPeriodSummary(tenantId);

  if (!usage) {
    return [];
  }

  const items: CostBreakdownItem[] = [
    {
      category: 'Call Minutes',
      used: Number(usage.total_call_minutes),
      included: plan.included_call_minutes,
      overage: Math.max(0, Number(usage.total_call_minutes) - plan.included_call_minutes),
      unit_price_cents: Number(plan.price_per_call_minute_cents),
      cost_cents: Math.max(0, Number(usage.total_call_minutes) - plan.included_call_minutes) * Number(plan.price_per_call_minute_cents),
    },
    {
      category: 'STT Seconds',
      used: Number(usage.total_stt_seconds),
      included: plan.included_stt_seconds,
      overage: Math.max(0, Number(usage.total_stt_seconds) - plan.included_stt_seconds),
      unit_price_cents: Number(plan.price_per_stt_second_cents),
      cost_cents: Math.max(0, Number(usage.total_stt_seconds) - plan.included_stt_seconds) * Number(plan.price_per_stt_second_cents),
    },
    {
      category: 'TTS Characters',
      used: usage.total_tts_characters,
      included: plan.included_tts_characters,
      overage: Math.max(0, usage.total_tts_characters - plan.included_tts_characters),
      unit_price_cents: Number(plan.price_per_tts_1k_chars_cents),
      cost_cents: Math.max(0, usage.total_tts_characters - plan.included_tts_characters) / 1000 * Number(plan.price_per_tts_1k_chars_cents),
    },
    {
      category: 'LLM Tokens',
      used: usage.total_llm_tokens,
      included: plan.included_llm_tokens,
      overage: Math.max(0, usage.total_llm_tokens - plan.included_llm_tokens),
      unit_price_cents: Number(plan.price_per_llm_1k_tokens_cents),
      cost_cents: Math.max(0, usage.total_llm_tokens - plan.included_llm_tokens) / 1000 * Number(plan.price_per_llm_1k_tokens_cents),
    },
  ];

  return items;
};

export const getBillingHistory = async (tenantId: string): Promise<BillingUsageSummary[]> => {
  return query<BillingUsageSummary>(
    `SELECT * FROM billing_usage_summaries
     WHERE tenant_id = $1
     ORDER BY period_start DESC
     LIMIT 12`,
    [tenantId]
  );
};
