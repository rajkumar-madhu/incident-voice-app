import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import VoicePreview from '@/components/marketing/VoicePreview';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

type HeroMediaProps = {
  className?: string;
};

/**
 * Hero product frame: optional muted loop video (desktop), poster on mobile / reduced motion.
 */
export default function HeroMedia({ className }: HeroMediaProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const showVideo = !reducedMotion && !isMobile;

  return (
    <div className={cn('relative', className)}>
      <div
        className="relative overflow-hidden rounded-2xl border border-border/80 bg-[#0e1116] shadow-2xl"
        aria-label="Product preview: live AI voice call with transcript"
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          {showVideo ? (
            <video
              className="absolute inset-0 h-full w-full object-cover opacity-90"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/hero-poster.svg"
              aria-hidden
            >
              <source src="/hero-loop.mp4" type="video/mp4" />
            </video>
          ) : (
            <img
              src="/hero-poster.svg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              decoding="async"
              fetchPriority="high"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1116]/80 via-transparent to-[#0e1116]/30" />
          <div className="relative z-10 p-4 sm:p-6">
            <VoicePreview className="border-white/10 bg-card/95 shadow-lg backdrop-blur-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
