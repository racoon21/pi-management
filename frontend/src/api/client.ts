// ???? ?? /api? ???? ???? ?????.
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error_code?: string;
}

export interface ApiResult<T> {
  data: T;
  message?: string;
  errorCode?: string;
}

// Silent Refresh: ?? 401 ?? ? ?? refresh ??
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
    parsed.state = {
      ...parsed.state,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    };
    localStorage.setItem('auth-storage', JSON.stringify(parsed));
  } catch {
    // ignore
  }
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
        Authorization: `Bearer ${token}`,
      };
    }

    return { 'Content-Type': 'application/json' };
  }

  private handleUnauthorized(): void {
    clearAuth();
    window.location.href = '/login';
  }

  private async requestResponse<T>(
    endpoint: string,
    options: RequestInit,
    isRetry = false,
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...(options.headers ?? {}),
      },
    });

    const isAuthEndpoint =
      endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/register');

    if (response.status === 401 && !isAuthEndpoint) {
      if (!isRetry) {
        if (!refreshPromise) {
          refreshPromise = silentRefresh().finally(() => {
            refreshPromise = null;
          });
        }

        const refreshed = await refreshPromise;
        if (refreshed) {
          return this.requestResponse<T>(endpoint, options, true);
        }
      }

      this.handleUnauthorized();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Network error' }));
      throw new ApiError(response.status, error.detail || error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private async request<T>(endpoint: string, options: RequestInit, isRetry = false): Promise<T> {
    const result = await this.requestResponse<T>(endpoint, options, isRetry);
    return result.data;
  }

  private async requestWithMeta<T>(
    endpoint: string,
    options: RequestInit,
    isRetry = false,
  ): Promise<ApiResult<T>> {
    const result = await this.requestResponse<T>(endpoint, options, isRetry);
    return {
      data: result.data,
      message: result.message,
      errorCode: result.error_code,
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async getWithMeta<T>(endpoint: string): Promise<ApiResult<T>> {
    return this.requestWithMeta<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async postWithMeta<T>(endpoint: string, data?: unknown): Promise<ApiResult<T>> {
    return this.requestWithMeta<T>(endpoint, {
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

  async putWithMeta<T>(endpoint: string, data: unknown): Promise<ApiResult<T>> {
    return this.requestWithMeta<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async deleteWithMeta<T>(endpoint: string): Promise<ApiResult<T>> {
    return this.requestWithMeta<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
