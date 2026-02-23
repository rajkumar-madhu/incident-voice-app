import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import CallHeatmap from '@/components/analytics/CallHeatmap';
import {
  useCallsOverTime, useCostOverTime,
  useLatencyPercentiles, useAgentPerformance,
} from '@/hooks/useAnalytics';
import { formatCost, formatDuration } from '@/lib/utils';
import { CHANNEL_COLORS } from '@/lib/constants';

const COLORS = ['#6366f1', '#f97316', '#06b6d4', '#22c55e', '#f43f5e'];

export default function AnalyticsPage() {
  const { data: callsData, isLoading: callsLoading } = useCallsOverTime({ interval: 'day' });
  const { data: costData } = useCostOverTime({});
  const { data: latencyData } = useLatencyPercentiles({});
  const { data: agentData } = useAgentPerformance({});

  const callPoints = ((callsData?.data || []) as Array<Record<string, unknown>>).map((p) => ({
    date: String(p.call_date).split('T')[0].slice(5),
    total: Number(p.total_calls),
    completed: Number(p.completed_calls),
    failed: Number(p.failed_calls),
    web: Number(p.web_calls),
    twilio: Number(p.twilio_calls),
    api: Number(p.api_calls),
    widget: Number(p.widget_calls),
  }));

  const costPoints = ((costData?.data || []) as Array<Record<string, unknown>>).map((p) => ({
    date: String(p.date).split('T')[0].slice(5),
    stt: Number(p.stt_cost),
    llm: Number(p.llm_cost),
    tts: Number(p.tts_cost),
    total: Number(p.total_cost),
  }));

  const latencyPoints = ((latencyData?.data || []) as Array<Record<string, unknown>>).map((p) => ({
    date: String(p.date).split('T')[0].slice(5),
    p50: Number(p.p50),
    p75: Number(p.p75),
    p90: Number(p.p90),
    p95: Number(p.p95),
  }));

  const agents = (agentData?.data || []) as Array<Record<string, unknown>>;

  if (callsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <Tabs defaultValue="calls">
        <TabsList>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="cost">Cost</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
        </TabsList>

        {/* Calls Tab */}
        <TabsContent value="calls" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call Volume Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={callPoints}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 5.9%, 90%)" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#gradTotal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="completed" stroke="#22c55e" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CallHeatmap />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Calls by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={callPoints.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 5.9%, 90%)" />
                    <XAxis dataKey="date" fontSize={12} tickLine={false} />
                    <YAxis fontSize={12} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="web" stackId="a" fill={CHANNEL_COLORS.web} />
                    <Bar dataKey="twilio" stackId="a" fill={CHANNEL_COLORS.twilio} />
                    <Bar dataKey="api" stackId="a" fill={CHANNEL_COLORS.api} />
                    <Bar dataKey="widget" stackId="a" fill={CHANNEL_COLORS.widget} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latency Percentiles (ms)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={latencyPoints}>
                  <defs>
                    <linearGradient id="gradP95" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 5.9%, 90%)" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="p95" stroke="#f43f5e" fill="url(#gradP95)" strokeWidth={1} />
                  <Area type="monotone" dataKey="p90" stroke="#f97316" fill="transparent" strokeWidth={1} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="p50" stroke="#6366f1" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Agent</th>
                      <th className="text-right p-3 font-medium">Calls</th>
                      <th className="text-right p-3 font-medium">Success Rate</th>
                      <th className="text-right p-3 font-medium">Avg Duration</th>
                      <th className="text-right p-3 font-medium">Avg Latency</th>
                      <th className="text-right p-3 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No agent data</td></tr>
                    ) : agents.map((a) => (
                      <tr key={String(a.agent_id)} className="border-b">
                        <td className="p-3 font-medium">{String(a.agent_name)}</td>
                        <td className="p-3 text-right">{Number(a.total_calls)}</td>
                        <td className="p-3 text-right">{Number(a.success_rate).toFixed(1)}%</td>
                        <td className="p-3 text-right">{formatDuration(Number(a.avg_duration))}</td>
                        <td className="p-3 text-right">{Math.round(Number(a.avg_latency))}ms</td>
                        <td className="p-3 text-right">{formatCost(Number(a.total_cost_cents))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Tab */}
        <TabsContent value="cost" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 5.9%, 90%)" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} />
                  <Tooltip formatter={(value: number) => formatCost(value)} />
                  <Legend />
                  <Bar dataKey="stt" stackId="a" fill="#3b82f6" name="STT" />
                  <Bar dataKey="llm" stackId="a" fill="#8b5cf6" name="LLM" />
                  <Bar dataKey="tts" stackId="a" fill="#22c55e" name="TTS" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality" className="space-y-6">
          {(() => {
            const sentimentTotals = callPoints.reduce(
              (acc, p) => {
                const raw = p as unknown as Record<string, number>;
                return {
                  positive: acc.positive + (raw.positive_sentiment || 0),
                  negative: acc.negative + (raw.negative_sentiment || 0),
                  neutral: acc.neutral + (raw.neutral_sentiment || 0),
                };
              },
              { positive: 0, negative: 0, neutral: 0 }
            );
            const sentimentData = [
              { name: 'Positive', value: sentimentTotals.positive },
              { name: 'Negative', value: sentimentTotals.negative },
              { name: 'Neutral', value: sentimentTotals.neutral },
            ];

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">Sentiment Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" label>
                          {sentimentData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Success Rate Trend</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={callPoints.map((p) => ({
                        date: p.date,
                        rate: p.total > 0 ? (p.completed / p.total * 100) : 0,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 5.9%, 90%)" />
                        <XAxis dataKey="date" fontSize={12} tickLine={false} />
                        <YAxis fontSize={12} tickLine={false} domain={[0, 100]} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                        <Line type="monotone" dataKey="rate" stroke="#22c55e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
