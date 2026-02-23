import { X, Phone, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCallLog } from '@/hooks/useCallLogs';
import { formatDuration, formatCost, getStatusColor, getSentimentColor } from '@/lib/utils';

interface CallDetailPanelProps {
  callId: string | null;
  onClose: () => void;
}

export default function CallDetailPanel({ callId, onClose }: CallDetailPanelProps) {
  const { data, isLoading } = useCallLog(callId);

  if (!callId) return null;

  const call = data?.data?.callLog as Record<string, unknown> | undefined;
  const transcript = (call?.transcript || []) as Array<{ role: string; content: string; created_at: string }>;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-background border-l shadow-xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-background z-10 flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Call Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : call ? (
        <div className="p-4 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(String(call.status))}`}>
                  {String(call.status)}
                </span>
                <Badge variant="secondary" className="capitalize">{String(call.channel)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {String(call.session_id).slice(0, 8)}...
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetricItem icon={<Clock className="h-4 w-4" />} label="Duration" value={formatDuration(Number(call.duration_seconds) || 0)} />
            <MetricItem icon={<MessageSquare className="h-4 w-4" />} label="Turns" value={String(call.turn_count || 0)} />
            <MetricItem label="STT Latency" value={`${String(call.stt_latency_ms ?? '-')}ms`} />
            <MetricItem label="LLM Latency" value={`${String(call.llm_latency_ms ?? '-')}ms`} />
            <MetricItem label="TTS Latency" value={`${String(call.tts_latency_ms ?? '-')}ms`} />
            <MetricItem label="Cost" value={formatCost(Number(call.total_cost_cents) || 0)} />
          </div>

          {/* Pipeline Timeline */}
          <div>
            <h3 className="text-sm font-medium mb-2">Pipeline Timeline</h3>
            <div className="flex items-center gap-1 text-xs">
              {[
                { label: 'STT', ms: call.stt_latency_ms, color: 'bg-blue-500' },
                { label: 'LLM', ms: call.llm_latency_ms, color: 'bg-purple-500' },
                { label: 'TTS', ms: call.tts_latency_ms, color: 'bg-green-500' },
              ].map((stage) => {
                const total = (Number(call.stt_latency_ms) || 0) + (Number(call.llm_latency_ms) || 0) + (Number(call.tts_latency_ms) || 0);
                const pct = total > 0 ? (Number(stage.ms) || 0) / total * 100 : 33;
                return (
                  <div key={stage.label} className="flex flex-col items-center" style={{ width: `${pct}%` }}>
                    <div className={`h-2 w-full rounded ${stage.color}`} />
                    <span className="mt-1 text-muted-foreground">{stage.label} {Number(stage.ms) || 0}ms</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sentiment */}
          {call.user_sentiment ? (
            <div>
              <h3 className="text-sm font-medium mb-1">Sentiment</h3>
              <span className={`text-sm capitalize ${getSentimentColor(String(call.user_sentiment))}`}>
                {String(call.user_sentiment)}
              </span>
            </div>
          ) : null}

          {/* Summary */}
          {call.transcript_summary ? (
            <div>
              <h3 className="text-sm font-medium mb-1">Summary</h3>
              <p className="text-sm text-muted-foreground">{String(call.transcript_summary)}</p>
            </div>
          ) : null}

          {/* Transcript */}
          {transcript.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Transcript</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {transcript.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Call not found
        </div>
      )}
    </div>
  );
}

function MetricItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}
