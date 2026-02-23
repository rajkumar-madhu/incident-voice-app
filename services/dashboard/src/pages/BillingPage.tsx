import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentBilling, useCostBreakdown, useBillingHistory } from '@/hooks/useBilling';
import { formatCost, formatNumber } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

const COLORS = ['#6366f1', '#f97316', '#06b6d4', '#22c55e'];

export default function BillingPage() {
  const { data: billingData, isLoading } = useCurrentBilling();
  const { data: breakdownData } = useCostBreakdown();
  const { data: historyData } = useBillingHistory();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const billing = billingData?.data as {
    plan: Record<string, unknown>;
    usage: Record<string, unknown>;
    projected_end_of_month_cost_cents: number;
    days_remaining: number;
  } | undefined;

  const breakdown = (breakdownData?.data || []) as Array<{
    category: string; used: number; included: number;
    overage: number; cost_cents: number;
  }>;

  const history = (historyData?.data || []) as Array<Record<string, unknown>>;

  const plan = billing?.plan;
  const usage = billing?.usage;
  const projected = billing?.projected_end_of_month_cost_cents || 0;
  const daysRemaining = billing?.days_remaining || 0;

  const planLimits = plan ? {
    call_minutes: { used: Number(usage?.total_call_minutes || 0), limit: Number(plan.included_call_minutes) },
    stt_seconds: { used: Number(usage?.total_stt_seconds || 0), limit: Number(plan.included_stt_seconds) },
    tts_characters: { used: Number(usage?.total_tts_characters || 0), limit: Number(plan.included_tts_characters) },
    llm_tokens: { used: Number(usage?.total_llm_tokens || 0), limit: Number(plan.included_llm_tokens) },
  } : null;

  const pieData = breakdown.map((b) => ({ name: b.category, value: b.cost_cents })).filter((b) => b.value > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Current Plan</CardTitle>
              <Badge variant="default" className="capitalize">{String(plan?.name || 'Free')}</Badge>
            </div>
            <CardDescription>{String(plan?.description || '')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCost(Number(plan?.monthly_base_price_cents || 0))}
              <span className="text-sm font-normal text-muted-foreground">/mo</span>
            </div>
            <Button className="w-full mt-4" variant="outline">Upgrade Plan</Button>
          </CardContent>
        </Card>

        {/* Projected Cost */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projected Cost</CardTitle>
            <CardDescription>{daysRemaining} days remaining</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCost(projected)}</div>
            {projected > Number(plan?.monthly_base_price_cents || 0) * 2 && (
              <div className="flex items-center gap-1.5 mt-2 text-amber-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Projected cost exceeds 2x base plan
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Spend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Spend</CardTitle>
            <CardDescription>This billing period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCost(Number(usage?.total_cost_cents || 0))}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {formatNumber(Number(usage?.total_calls || 0))} calls
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Meters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage This Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {planLimits && Object.entries(planLimits).map(([key, { used, limit }]) => {
              const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">
                      {formatNumber(used)} / {formatNumber(limit)}
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    className="h-3"
                    indicatorClassName={
                      pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'
                    }
                  />
                  {pct > 80 && (
                    <p className="text-xs text-amber-600">{Math.round(pct)}% used</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Cost Breakdown Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${formatCost(value)}`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCost(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No cost data yet
              </div>
            )}

            {breakdown.length > 0 && (
              <div className="mt-4 space-y-2">
                {breakdown.map((b) => (
                  <div key={b.category} className="flex items-center justify-between text-sm">
                    <span>{b.category}</span>
                    <span className="font-medium">{formatCost(b.cost_cents)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Period</th>
                <th className="text-right p-3 font-medium">Calls</th>
                <th className="text-right p-3 font-medium">Base</th>
                <th className="text-right p-3 font-medium">Overage</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No billing history</td></tr>
              ) : history.map((h) => (
                <tr key={String(h.id)} className="border-b">
                  <td className="p-3">{String(h.period_start)} - {String(h.period_end)}</td>
                  <td className="p-3 text-right">{Number(h.total_calls)}</td>
                  <td className="p-3 text-right">{formatCost(Number(h.base_cost_cents))}</td>
                  <td className="p-3 text-right">{formatCost(Number(h.overage_cost_cents))}</td>
                  <td className="p-3 text-right font-medium">{formatCost(Number(h.total_cost_cents))}</td>
                  <td className="p-3">
                    <Badge variant={String(h.status) === 'paid' ? 'success' : 'secondary'} className="capitalize">
                      {String(h.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
