import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useCallsOverTime(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['analytics', 'calls-over-time', params],
    queryFn: () => api.getCallsOverTime(params),
  });
}

export function useCostOverTime(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['analytics', 'cost-over-time', params],
    queryFn: () => api.getCostOverTime(params),
  });
}

export function useLatencyPercentiles(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['analytics', 'latency-percentiles', params],
    queryFn: () => api.getLatencyPercentiles(params),
  });
}

export function useAgentPerformance(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['analytics', 'agent-performance', params],
    queryFn: () => api.getAgentPerformance(params),
  });
}

export function useCallHeatmap() {
  return useQuery({
    queryKey: ['analytics', 'call-heatmap'],
    queryFn: () => api.getCallHeatmap(),
  });
}
