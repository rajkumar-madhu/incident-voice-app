import { Phone, Shield, Server } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useActivityFeed } from '@/hooks/useDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

const typeIcons: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  audit: <Shield className="h-4 w-4" />,
  system: <Server className="h-4 w-4" />,
};

export default function ActivityFeed() {
  const { data, isLoading } = useActivityFeed(15);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const items = (data?.data || []) as Array<{
    id: string; type: string; title: string;
    description: string; timestamp: string;
  }>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5 text-muted-foreground">
                {typeIcons[item.type] || typeIcons.system}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.title}</p>
                <p className="text-muted-foreground truncate text-xs">{item.description}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
