import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/postgres.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import * as billingService from '../services/billingService.js';
import type { KpiCard, DashboardOverview, ActivityItem } from '../types/dashboard.js';

const router = Router();

router.get(
  '/overview',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.context!.tenant_id;
      const now = new Date();
      const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      // Current period stats
      const [currentStats, previousStats, channelStats, statusStats, recentCalls] = await Promise.all([
        query<{
          total_calls: number; avg_duration: number;
          completed_calls: number; total_cost: number;
        }>(
          `SELECT
            COUNT(*)::int AS total_calls,
            COALESCE(AVG(duration_seconds), 0)::float AS avg_duration,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_calls,
            COALESCE(SUM(total_cost_cents), 0)::float AS total_cost
          FROM call_logs
          WHERE tenant_id = $1 AND started_at >= $2`,
          [tenantId, currentPeriodStart]
        ),
        query<{
          total_calls: number; avg_duration: number;
          completed_calls: number; total_cost: number;
        }>(
          `SELECT
            COUNT(*)::int AS total_calls,
            COALESCE(AVG(duration_seconds), 0)::float AS avg_duration,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_calls,
            COALESCE(SUM(total_cost_cents), 0)::float AS total_cost
          FROM call_logs
          WHERE tenant_id = $1 AND started_at >= $2 AND started_at < $3`,
          [tenantId, previousPeriodStart, currentPeriodStart]
        ),
        query<{ channel: string; count: number }>(
          `SELECT channel, COUNT(*)::int AS count FROM call_logs
           WHERE tenant_id = $1 AND started_at >= $2
           GROUP BY channel`,
          [tenantId, currentPeriodStart]
        ),
        query<{ status: string; count: number }>(
          `SELECT status, COUNT(*)::int AS count FROM call_logs
           WHERE tenant_id = $1 AND started_at >= $2
           GROUP BY status`,
          [tenantId, currentPeriodStart]
        ),
        query(
          `SELECT id, session_id, agent_id, channel, status, duration_seconds,
                  started_at, user_sentiment, transcript_summary
           FROM call_logs
           WHERE tenant_id = $1
           ORDER BY started_at DESC LIMIT 10`,
          [tenantId]
        ),
      ]);

      const cur = currentStats[0];
      const prev = previousStats[0];

      const calcChange = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100 * 100) / 100;
      };

      const curSuccessRate = cur.total_calls > 0
        ? (cur.completed_calls / cur.total_calls) * 100 : 0;
      const prevSuccessRate = prev.total_calls > 0
        ? (prev.completed_calls / prev.total_calls) * 100 : 0;

      const total_calls: KpiCard = {
        value: cur.total_calls,
        previous_value: prev.total_calls,
        change_percent: calcChange(cur.total_calls, prev.total_calls),
      };

      const avg_duration: KpiCard = {
        value: Math.round(cur.avg_duration * 100) / 100,
        previous_value: Math.round(prev.avg_duration * 100) / 100,
        change_percent: calcChange(cur.avg_duration, prev.avg_duration),
      };

      const success_rate: KpiCard = {
        value: Math.round(curSuccessRate * 100) / 100,
        previous_value: Math.round(prevSuccessRate * 100) / 100,
        change_percent: calcChange(curSuccessRate, prevSuccessRate),
      };

      const total_cost: KpiCard = {
        value: Math.round(cur.total_cost * 100) / 100,
        previous_value: Math.round(prev.total_cost * 100) / 100,
        change_percent: calcChange(cur.total_cost, prev.total_cost),
      };

      const calls_by_channel: Record<string, number> = {};
      for (const row of channelStats) {
        calls_by_channel[row.channel] = row.count;
      }

      const calls_by_status: Record<string, number> = {};
      for (const row of statusStats) {
        calls_by_status[row.status] = row.count;
      }

      // Get usage vs limits
      let usage_vs_limits;
      try {
        const billing = await billingService.getCurrentPeriodBilling(tenantId);
        usage_vs_limits = {
          call_minutes: { used: Number(billing.usage.total_call_minutes), limit: billing.plan.included_call_minutes },
          stt_seconds: { used: Number(billing.usage.total_stt_seconds), limit: billing.plan.included_stt_seconds },
          tts_characters: { used: billing.usage.total_tts_characters, limit: billing.plan.included_tts_characters },
          llm_tokens: { used: billing.usage.total_llm_tokens, limit: billing.plan.included_llm_tokens },
          api_calls: { used: billing.usage.total_api_calls, limit: billing.plan.included_api_calls },
        };
      } catch {
        usage_vs_limits = {
          call_minutes: { used: 0, limit: 100 },
          stt_seconds: { used: 0, limit: 6000 },
          tts_characters: { used: 0, limit: 100000 },
          llm_tokens: { used: 0, limit: 500000 },
          api_calls: { used: 0, limit: 1000 },
        };
      }

      res.json({
        success: true,
        data: {
          total_calls,
          avg_duration,
          success_rate,
          total_cost,
          calls_by_channel,
          calls_by_status,
          recent_calls: recentCalls,
          usage_vs_limits,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/activity-feed',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.context!.tenant_id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      const [callActivities, auditActivities] = await Promise.all([
        query<ActivityItem>(
          `SELECT
            id::text,
            'call' AS type,
            CONCAT(channel, ' call - ', status) AS title,
            COALESCE(transcript_summary, CONCAT('Duration: ', ROUND(duration_seconds::numeric, 1), 's')) AS description,
            started_at::text AS timestamp
          FROM call_logs
          WHERE tenant_id = $1
          ORDER BY started_at DESC LIMIT $2`,
          [tenantId, limit]
        ),
        query<ActivityItem>(
          `SELECT
            id::text,
            'audit' AS type,
            action AS title,
            COALESCE(details::text, '') AS description,
            created_at::text AS timestamp
          FROM audit_logs
          WHERE tenant_id = $1
          ORDER BY created_at DESC LIMIT $2`,
          [tenantId, limit]
        ),
      ]);

      // Merge and sort by timestamp
      const feed = [...callActivities, ...auditActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      res.json({ success: true, data: feed });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
