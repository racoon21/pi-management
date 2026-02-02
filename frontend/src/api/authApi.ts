import { apiClient } from './client';
import type { User } from '../types/task';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

interface LoginRequest {
  employee_id: string;
  password: string;
}

export const authApi = {
  login: async (employeeId: string, password: string): Promise<TokenResponse> => {
    const data: LoginRequest = {
      employee_id: employeeId,
      password: password,
    };
    return apiClient.post<TokenResponse>('/auth/login', data);
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    return apiClient.post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken });
  },

  getMe: async (): Promise<User> => {
    return apiClient.get<User>('/auth/me');
  },
};
