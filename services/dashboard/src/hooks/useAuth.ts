import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';

interface AuthState {
  token: string | null;
  user: Record<string, unknown> | null;
}

let globalState: AuthState = {
  token: localStorage.getItem('auth_token'),
  user: null,
};

// Initialize API client with stored token
if (globalState.token) {
  api.setToken(globalState.token);
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function startSession(accessToken: string, user: unknown) {
  globalState = { token: accessToken, user: user as Record<string, unknown> };
  localStorage.setItem('auth_token', accessToken);
  api.setToken(accessToken);
  notifyListeners();
}

export function useAuth() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const login = useCallback(async (email: string, password: string, tenantId?: string) => {
    const res = await api.login(email, password, tenantId);
    startSession(res.data.tokens.accessToken, res.data.user);
  }, []);

  const signup = useCallback(async (details: Parameters<typeof api.signup>[0]) => {
    const res = await api.signup(details);
    startSession(res.data.tokens.accessToken, res.data.user);
  }, []);

  const logout = useCallback(() => {
    globalState = { token: null, user: null };
    localStorage.removeItem('auth_token');
    api.setToken(null);
    notifyListeners();
  }, []);

  return {
    token: globalState.token,
    user: globalState.user,
    login,
    signup,
    logout,
  };
}
