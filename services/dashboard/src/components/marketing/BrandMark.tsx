import { Link } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
type BrandMarkProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  linkHome?: boolean;
};

const sizes = {
  sm: { icon: 'h-5 w-5', text: 'text-lg', stack: 'gap-0.5' },
  md: { icon: 'h-7 w-7', text: 'text-xl', stack: 'gap-0.5' },
  lg: { icon: 'h-8 w-8', text: 'text-2xl', stack: 'gap-1' },
};

export default function BrandMark({
  className,
  size = 'md',
  linkHome = true,
}: BrandMarkProps) {
  const s = sizes[size];
  const inner = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Mic className={s.icon} aria-hidden />
      </span>
      <span className={cn('flex flex-col', s.stack)}>
        <span className={cn('font-serif font-normal leading-tight tracking-tight', s.text)}>
          WeCrew <span className="text-primary font-sans font-semibold">Voice</span>
        </span>
      </span>
    </span>
  );

  if (linkHome) {
    return (
      <Link to="/" className="hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}
