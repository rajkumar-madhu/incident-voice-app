import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useCallLogs(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['call-logs', params],
    queryFn: () => api.getCallLogs(params),
  });
}

export function useCallLog(id: string | null) {
  return useQuery({
    queryKey: ['call-logs', id],
    queryFn: () => api.getCallLog(id!),
    enabled: !!id,
  });
}
