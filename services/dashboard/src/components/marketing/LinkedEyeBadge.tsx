import { cn } from '@/lib/utils';

/** Sub-brand line under WeCrew Voice on public pages. */
export default function LinkedEyeBadge({ className }: { className?: string }) {
  return (
    <span className={cn('text-xs font-medium tracking-wide text-muted-foreground', className)}>
      Powered by{' '}
      <span className="text-foreground/80">LinkedEye</span>
    </span>
  );
}
