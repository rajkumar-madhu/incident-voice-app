import { useState, useMemo } from 'react';
import { Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import CallDetailPanel from '@/components/calls/CallDetailPanel';
import { useCallLogs } from '@/hooks/useCallLogs';
import { formatDuration, formatCost, getStatusColor } from '@/lib/utils';
import { CHANNELS, STATUSES } from '@/lib/constants';

export default function CallLogsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: '20' };
    if (search) p.search = search;
    if (statusFilter) p.status = statusFilter;
    if (channelFilter) p.channel = channelFilter;
    return p;
  }, [page, search, statusFilter, channelFilter]);

  const { data, isLoading } = useCallLogs(params);

  const calls = (data?.data || []) as Array<Record<string, unknown>>;
  const pagination = data?.pagination as { page: number; total_pages: number; total: number } | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Call Logs</h1>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcripts..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>

        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={channelFilter}
          onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Channels</option>
          {CHANNELS.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Channel</th>
                    <th className="text-left p-3 font-medium">Duration</th>
                    <th className="text-left p-3 font-medium">Latency</th>
                    <th className="text-left p-3 font-medium">Cost</th>
                    <th className="text-left p-3 font-medium">Sentiment</th>
                    <th className="text-left p-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        No calls found
                      </td>
                    </tr>
                  ) : (
                    calls.map((call) => (
                      <tr
                        key={String(call.id)}
                        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedId(String(call.id))}
                      >
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(String(call.status))}`}>
                            {String(call.status)}
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className="capitalize text-xs">{String(call.channel)}</Badge>
                        </td>
                        <td className="p-3">{formatDuration(Number(call.duration_seconds) || 0)}</td>
                        <td className="p-3 text-muted-foreground">{call.total_latency_ms ? `${call.total_latency_ms}ms` : '-'}</td>
                        <td className="p-3">{formatCost(Number(call.total_cost_cents) || 0)}</td>
                        <td className="p-3 capitalize text-muted-foreground">{String(call.user_sentiment || '-')}</td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(String(call.started_at)).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <span className="text-sm text-muted-foreground">
                {pagination.total} total calls
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {page} of {pagination.total_pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.total_pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Panel (Notion-style sheet) */}
      <CallDetailPanel callId={selectedId} onClose={() => setSelectedId(null)} />
      {selectedId && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
