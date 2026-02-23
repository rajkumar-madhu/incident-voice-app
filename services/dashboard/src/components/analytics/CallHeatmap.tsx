import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useCallHeatmap } from '@/hooks/useAnalytics';
import { DAYS_OF_WEEK } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function CallHeatmap() {
  const { data } = useCallHeatmap();
  const cells = (data?.data || []) as Array<{ day_of_week: number; hour_of_day: number; call_count: number }>;

  // Build a lookup map
  const map = new Map<string, number>();
  let maxCount = 1;
  for (const cell of cells) {
    const key = `${cell.day_of_week}-${cell.hour_of_day}`;
    map.set(key, cell.call_count);
    if (cell.call_count > maxCount) maxCount = cell.call_count;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Call Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex ml-10">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {h % 3 === 0 ? `${h}` : ''}
                </div>
              ))}
            </div>

            {/* Grid */}
            {DAYS_OF_WEEK.map((day, dayIdx) => (
              <div key={day} className="flex items-center">
                <div className="w-10 text-xs text-muted-foreground">{day}</div>
                <div className="flex flex-1 gap-[1px]">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const count = map.get(`${dayIdx}-${hour}`) || 0;
                    const intensity = count / maxCount;
                    return (
                      <div
                        key={hour}
                        className={cn(
                          'flex-1 aspect-square rounded-[2px] transition-colors',
                          count === 0
                            ? 'bg-muted'
                            : intensity < 0.25
                            ? 'bg-primary/20'
                            : intensity < 0.5
                            ? 'bg-primary/40'
                            : intensity < 0.75
                            ? 'bg-primary/60'
                            : 'bg-primary'
                        )}
                        title={`${day} ${hour}:00 - ${count} calls`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
