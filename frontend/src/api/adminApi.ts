import { apiClient } from './client';
import type { User } from '../types/task';

export interface UserListItem {
  id: string;
  employee_id: string;
  name: string;
  organization: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export const adminApi = {
  getUsers: async (params?: { role?: string; is_active?: boolean }): Promise<UserListItem[]> => {
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
    const qs = query.toString();
    return apiClient.get<UserListItem[]>(`/admin/users${qs ? `?${qs}` : ''}`);
  },

  getPendingUsers: async (): Promise<UserListItem[]> => {
    return apiClient.get<UserListItem[]>('/admin/users/pending');
  },

  updateRole: async (userId: string, role: string): Promise<User> => {
    return apiClient.put<User>(`/admin/users/${userId}/role`, { role });
  },

  toggleActive: async (userId: string, isActive: boolean): Promise<User> => {
    return apiClient.put<User>(`/admin/users/${userId}/active`, { is_active: isActive });
  },
};
