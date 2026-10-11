import { cn } from '@/lib/utils';

const HEIGHTS = [0.35, 0.55, 0.85, 0.65, 1, 0.75, 0.5, 0.9, 0.6, 0.45, 0.7, 0.55];

type WaveformBarsProps = {
  className?: string;
  /** Pause CSS animation when user prefers reduced motion */
  paused?: boolean;
};

export default function WaveformBars({ className, paused }: WaveformBarsProps) {
  return (
    <div
      className={cn('flex h-8 items-end justify-center gap-0.5', className)}
      role="img"
      aria-label="Audio waveform visualization"
    >
      {HEIGHTS.map((h, i) => (
        <span
          key={i}
          className={cn(
            'w-1 rounded-full bg-primary/80',
            !paused && 'animate-wave-bar',
          )}
          style={{
            height: `${h * 100}%`,
            animationDelay: paused ? undefined : `${i * 0.07}s`,
          }}
        />
      ))}
    </div>
  );
}
