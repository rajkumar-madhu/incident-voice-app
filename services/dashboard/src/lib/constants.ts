export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: 'LayoutDashboard' },
  { path: '/calls', label: 'Call Logs', icon: 'Phone' },
  { path: '/analytics', label: 'Analytics', icon: 'BarChart3' },
  { path: '/agents', label: 'Agents', icon: 'Bot' },
  { path: '/api-keys', label: 'API Keys', icon: 'Key' },
  { path: '/billing', label: 'Billing', icon: 'CreditCard' },
  { path: '/settings', label: 'Settings', icon: 'Settings' },
] as const;

export const CHANNELS = ['web', 'twilio', 'api', 'widget'] as const;
export const STATUSES = ['completed', 'failed', 'abandoned', 'no_answer', 'busy', 'in_progress'] as const;
export const SENTIMENTS = ['positive', 'neutral', 'negative', 'mixed'] as const;

export const CHANNEL_COLORS: Record<string, string> = {
  web: '#6366f1',
  twilio: '#f97316',
  api: '#06b6d4',
  widget: '#8b5cf6',
};

export const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  failed: '#ef4444',
  abandoned: '#f59e0b',
  no_answer: '#6b7280',
  busy: '#f97316',
  in_progress: '#3b82f6',
};

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);
