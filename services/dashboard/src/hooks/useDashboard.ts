import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api.getDashboardOverview(),
    refetchInterval: 30_000,
  });
}

export function useActivityFeed(limit = 20) {
  return useQuery({
    queryKey: ['dashboard', 'activity-feed', limit],
    queryFn: () => api.getActivityFeed(limit),
    refetchInterval: 15_000,
  });
}
