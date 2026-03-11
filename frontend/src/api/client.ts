// 프록시를 통해 /api로 요청하면 백엔드로 전달됨
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Silent Refresh: 동시 401 요청 시 중복 refresh 방지
let refreshPromise: Promise<boolean> | null = null;

function getAuthState() {
  const raw = localStorage.getItem('auth-storage');
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.state ?? null;
  } catch {
    return null;
  }
}

function setAuthTokens(accessToken: string, refreshToken: string) {
  const raw = localStorage.getItem('auth-storage');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    parsed.state = { ...parsed.state, accessToken, refreshToken, isAuthenticated: true };
    localStorage.setItem('auth-storage', JSON.stringify(parsed));
  } catch { /* ignore */ }
}

function clearAuth() {
  localStorage.removeItem('auth-storage');
}

async function silentRefresh(): Promise<boolean> {
  const state = getAuthState();
  const refreshToken = state?.refreshToken;
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;

    const result: ApiResponse<{ access_token: string; refresh_token: string }> = await res.json();
    if (result.data?.access_token) {
      setAuthTokens(result.data.access_token, result.data.refresh_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const state = getAuthState();
    const token = state?.accessToken;
    if (token) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
    }
    return { 'Content-Type': 'application/json' };
  }

  private handleUnauthorized(): void {
    clearAuth();
    window.location.href = '/login';
  }

  private async request<T>(endpoint: string, options: RequestInit, isRetry = false): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: this.getAuthHeaders(),
    });

    if (response.status === 401 && !isRetry) {
      // Silent Refresh 시도 (동시 요청 큐잉)
      if (!refreshPromise) {
        refreshPromise = silentRefresh().finally(() => { refreshPromise = null; });
      }
      const refreshed = await refreshPromise;

      if (refreshed) {
        // 새 토큰으로 원래 요청 재시도
        return this.request<T>(endpoint, options, true);
      }

      this.handleUnauthorized();
      throw new Error('Unauthorized');
    }

    if (response.status === 401) {
      this.handleUnauthorized();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Network error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const result: ApiResponse<T> = await response.json();
    return result.data;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
