import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useCurrentBilling() {
  return useQuery({
    queryKey: ['billing', 'current'],
    queryFn: () => api.getCurrentBilling(),
  });
}

export function useBillingHistory() {
  return useQuery({
    queryKey: ['billing', 'history'],
    queryFn: () => api.getBillingHistory(),
  });
}

export function useCostBreakdown() {
  return useQuery({
    queryKey: ['billing', 'cost-breakdown'],
    queryFn: () => api.getCostBreakdown(),
  });
}
