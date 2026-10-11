import { useEffect, useState } from 'react';
import { Phone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import WaveformBars from '@/components/marketing/WaveformBars';

const LINES = [
  { role: 'caller', text: 'Hi — our checkout page is failing for EU customers.' },
  { role: 'agent', text: 'I can help. Are they seeing a payment error or a blank screen?' },
  { role: 'caller', text: 'Payment declined, but only for cards issued in Germany.' },
  { role: 'agent', text: 'Got it. I’ll open a P1 ticket and notify on-call with the last three error IDs.' },
];

type VoicePreviewProps = {
  className?: string;
  compact?: boolean;
};

export default function VoicePreview({ className, compact }: VoicePreviewProps) {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card/80 shadow-xl backdrop-blur-sm',
        compact ? 'p-4' : 'p-6',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-[hsl(var(--wecrew-coral)/0.15)] blur-2xl" />

      <div className="relative flex items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          Live call · inbound
        </div>
        <WaveformBars paused={reduceMotion} className="hidden min-w-[72px] sm:flex" />
        <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          AI agent
        </div>
      </div>

      <div className={cn('relative mt-4 space-y-3', compact && 'mt-3 space-y-2')}>
        {LINES.map((line, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed',
              line.role === 'caller'
                ? 'mr-auto bg-muted text-foreground'
                : 'ml-auto border border-primary/20 bg-primary/5 text-foreground',
            )}
          >
            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {line.role === 'caller' ? 'Customer' : 'WeCrew Voice'}
            </span>
            {line.text}
          </div>
        ))}
      </div>

      <div className="relative mt-5 flex items-center gap-3 rounded-lg border border-dashed bg-background/60 px-3 py-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Phone className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">Next action</p>
          <p className="truncate text-sm font-medium">Ticket #4821 · PagerDuty notified</p>
        </div>
      </div>
    </div>
  );
}
