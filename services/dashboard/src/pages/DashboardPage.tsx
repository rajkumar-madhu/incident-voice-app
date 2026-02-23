import { Phone, Clock, CheckCircle, DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import KpiCard from '@/components/dashboard/KpiCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import { useDashboardOverview } from '@/hooks/useDashboard';
import { useCallsOverTime } from '@/hooks/useAnalytics';
import { formatDuration, formatCost, formatNumber, formatPercent } from '@/lib/utils';

export default function DashboardPage() {
  const { data: overview, isLoading } = useDashboardOverview();
  const { data: chartData } = useCallsOverTime({ interval: 'day' });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const d = overview?.data as Record<string, unknown> | undefined;
  const totalCalls = d?.total_calls as { value: number; change_percent: number } | undefined;
  const avgDuration = d?.avg_duration as { value: number; change_percent: number } | undefined;
  const successRate = d?.success_rate as { value: number; change_percent: number } | undefined;
  const totalCost = d?.total_cost as { value: number; change_percent: number } | undefined;
  const usageLimits = d?.usage_vs_limits as Record<string, { used: number; limit: number }> | undefined;
  const callsByChannel = d?.calls_by_channel as Record<string, number> | undefined;
  const recentCalls = (d?.recent_calls || []) as Array<Record<string, unknown>>;
  const chartPoints = ((chartData?.data || []) as Array<Record<string, unknown>>).map((p) => ({
    date: String(p.call_date).split('T')[0].slice(5),
    calls: Number(p.total_calls),
    completed: Number(p.completed_calls),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-sm text-muted-foreground">All systems operational</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Calls"
          value={formatNumber(totalCalls?.value || 0)}
          change={totalCalls?.change_percent || 0}
          icon={<Phone className="h-4 w-4" />}
        />
        <KpiCard
          title="Avg Duration"
          value={formatDuration(avgDuration?.value || 0)}
          change={avgDuration?.change_percent || 0}
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiCard
          title="Success Rate"
          value={formatPercent(successRate?.value || 0)}
          change={successRate?.change_percent || 0}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <KpiCard
          title="Total Cost"
          value={formatCost(totalCost?.value || 0)}
          change={totalCost?.change_percent || 0}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Charts + Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call Volume Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Call Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {chartPoints.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartPoints}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 5.9%, 90%)" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="hsl(239, 84%, 67%)"
                    fillOpacity={1}
                    fill="url(#colorCalls)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                No call data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <ActivityFeed />
      </div>

      {/* Usage + Channel Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage vs Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage vs Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {usageLimits && Object.entries(usageLimits).map(([key, { used, limit }]) => {
              const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="text-muted-foreground">
                      {formatNumber(used)} / {formatNumber(limit)}
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    indicatorClassName={pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : ''}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Channel Breakdown + Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            {callsByChannel && Object.keys(callsByChannel).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(callsByChannel).map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <Badge variant="secondary" className="capitalize">{channel}</Badge>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No calls yet</p>
            )}

            {recentCalls.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm font-medium mb-3">Recent Calls</p>
                <div className="space-y-2">
                  {recentCalls.slice(0, 5).map((call) => (
                    <div key={String(call.id)} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={call.status === 'completed' ? 'success' : 'destructive'} className="text-xs">
                          {String(call.status)}
                        </Badge>
                        <span className="text-muted-foreground capitalize">{String(call.channel)}</span>
                      </div>
                      <span className="text-muted-foreground">{formatDuration(Number(call.duration_seconds) || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
