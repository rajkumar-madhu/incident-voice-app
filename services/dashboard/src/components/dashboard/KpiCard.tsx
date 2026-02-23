import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
}

export default function KpiCard({ title, value, change, icon }: KpiCardProps) {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{value}</p>
          <div className="flex items-center gap-1 mt-1">
            {isNeutral ? (
              <Minus className="h-3 w-3 text-muted-foreground" />
            ) : isPositive ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-600" />
            )}
            <span className={cn(
              'text-xs font-medium',
              isNeutral ? 'text-muted-foreground' : isPositive ? 'text-green-600' : 'text-red-600'
            )}>
              {isNeutral ? '0%' : `${isPositive ? '+' : ''}${change.toFixed(1)}%`}
            </span>
            <span className="text-xs text-muted-foreground">vs last period</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
