// 프록시를 통해 /api로 요청하면 백엔드로 전달됨
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth-storage');
    if (token) {
      try {
        const parsed = JSON.parse(token);
        if (parsed.state?.accessToken) {
          return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${parsed.state.accessToken}`,
          };
        }
      } catch {
        // ignore parse error
      }
    }
    return { 'Content-Type': 'application/json' };
  }

  private handleUnauthorized(): void {
    // Clear auth storage
    localStorage.removeItem('auth-storage');
    // Redirect to login page
    window.location.href = '/login';
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

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

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

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

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

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

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

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
}

export const apiClient = new ApiClient(API_BASE_URL);
