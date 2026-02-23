const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params } = options;

    let url = `${API_BASE}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          searchParams.set(key, value);
        }
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      this.token = null;
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data;
  }

  // Auth
  login(email: string, password: string, tenantId?: string) {
    return this.request<{ success: boolean; data: { tokens: { accessToken: string; refreshToken: string; expiresIn: number }; user: unknown } }>('/auth/login', {
      method: 'POST',
      body: { email, password, tenant_id: tenantId },
    });
  }

  // Dashboard
  getDashboardOverview() {
    return this.request<{ success: boolean; data: unknown }>('/dashboard/overview');
  }

  getActivityFeed(limit = 20) {
    return this.request<{ success: boolean; data: unknown[] }>('/dashboard/activity-feed', { params: { limit: String(limit) } });
  }

  // Call Logs
  getCallLogs(params: Record<string, string> = {}) {
    return this.request<{ success: boolean; data: unknown[]; pagination: unknown }>('/call-logs', { params });
  }

  getCallLog(id: string) {
    return this.request<{ success: boolean; data: { callLog: unknown } }>(`/call-logs/${id}`);
  }

  // Analytics
  getCallsOverTime(params: Record<string, string> = {}) {
    return this.request<{ success: boolean; data: unknown[] }>('/analytics/calls-over-time', { params });
  }

  getCostOverTime(params: Record<string, string> = {}) {
    return this.request<{ success: boolean; data: unknown[] }>('/analytics/cost-over-time', { params });
  }

  getLatencyPercentiles(params: Record<string, string> = {}) {
    return this.request<{ success: boolean; data: unknown[] }>('/analytics/latency-percentiles', { params });
  }

  getAgentPerformance(params: Record<string, string> = {}) {
    return this.request<{ success: boolean; data: unknown[] }>('/analytics/agent-performance', { params });
  }

  getCallHeatmap() {
    return this.request<{ success: boolean; data: unknown[] }>('/analytics/call-heatmap');
  }

  // Agents
  getAgents(includeInactive = false) {
    return this.request<{ success: boolean; data: { agents: unknown[] } }>('/agents', {
      params: includeInactive ? { include_inactive: 'true' } : {},
    });
  }

  getAgent(id: string) {
    return this.request<{ success: boolean; data: { agent: unknown } }>(`/agents/${id}`);
  }

  createAgent(data: unknown) {
    return this.request<{ success: boolean; data: { agent: unknown } }>('/agents', { method: 'POST', body: data });
  }

  updateAgent(id: string, data: unknown) {
    return this.request<{ success: boolean; data: { agent: unknown } }>(`/agents/${id}`, { method: 'PUT', body: data });
  }

  deleteAgent(id: string) {
    return this.request<{ success: boolean }>(`/agents/${id}`, { method: 'DELETE' });
  }

  duplicateAgent(id: string) {
    return this.request<{ success: boolean; data: { agent: unknown } }>(`/agents/${id}/duplicate`, { method: 'POST' });
  }

  // API Keys
  getApiKeys(includeInactive = false) {
    return this.request<{ success: boolean; data: { apiKeys: unknown[] } }>('/api-keys', {
      params: includeInactive ? { include_inactive: 'true' } : {},
    });
  }

  createApiKey(data: unknown) {
    return this.request<{ success: boolean; data: { apiKey: unknown; rawKey: string } }>('/api-keys', { method: 'POST', body: data });
  }

  revokeApiKey(id: string) {
    return this.request<{ success: boolean }>(`/api-keys/${id}`, { method: 'DELETE' });
  }

  rotateApiKey(id: string) {
    return this.request<{ success: boolean; data: { apiKey: unknown; rawKey: string } }>(`/api-keys/${id}/rotate`, { method: 'POST' });
  }

  // Billing
  getCurrentBilling() {
    return this.request<{ success: boolean; data: unknown }>('/billing/current-period');
  }

  getBillingHistory() {
    return this.request<{ success: boolean; data: unknown[] }>('/billing/history');
  }

  getCostBreakdown() {
    return this.request<{ success: boolean; data: unknown[] }>('/billing/cost-breakdown');
  }

  // Phone Numbers
  getPhoneNumbers() {
    return this.request<{ success: boolean; data: { phoneNumbers: unknown[] } }>('/phone-numbers');
  }

  createPhoneNumber(data: unknown) {
    return this.request<{ success: boolean; data: { phoneNumber: unknown } }>('/phone-numbers', { method: 'POST', body: data });
  }

  updatePhoneNumber(id: string, data: unknown) {
    return this.request<{ success: boolean; data: { phoneNumber: unknown } }>(`/phone-numbers/${id}`, { method: 'PUT', body: data });
  }

  deletePhoneNumber(id: string) {
    return this.request<{ success: boolean }>(`/phone-numbers/${id}`, { method: 'DELETE' });
  }

  // Users / Settings
  getUsers() {
    return this.request<{ success: boolean; data: { users: unknown[] } }>('/users');
  }
}

export const api = new ApiClient();
