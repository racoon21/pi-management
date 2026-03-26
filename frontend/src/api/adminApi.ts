import { apiClient, type ApiResult } from './client';

export interface UserListItem {
  id: string;
  employee_id: string;
  name: string;
  organization: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminDashboardRoleCounts {
  admin: number;
  editor: number;
  viewer: number;
  pending: number;
}

export interface AdminDashboardOrganizationCount {
  organization: string;
  user_count: number;
}

export interface AdminDashboardSummary {
  total_users: number;
  active_users: number;
  inactive_users: number;
  pending_users: number;
  recent_signups_7d: number;
  role_counts: AdminDashboardRoleCounts;
  organization_counts: AdminDashboardOrganizationCount[];
  recent_signups: UserListItem[];
}

export type AdminActivitySource = 'all' | 'task_history' | 'user_signup' | 'admin_audit';
export type AdminActivityAction =
  | 'all'
  | 'TASK_CREATE'
  | 'TASK_UPDATE'
  | 'TASK_DELETE'
  | 'USER_REGISTERED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_ROLE_CHANGED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED';

export interface AdminActivitySourceCounts {
  total: number;
  task_history: number;
  user_signup: number;
  admin_audit: number;
}

export interface AdminActivityActionCounts {
  task_create: number;
  task_update: number;
  task_delete: number;
  user_registered: number;
  user_approved: number;
  user_rejected: number;
  user_role_changed: number;
  user_activated: number;
  user_deactivated: number;
}

export interface AdminActivityLogItem {
  id: string;
  source: 'task_history' | 'user_signup' | 'admin_audit';
  source_label: string;
  action:
    | 'TASK_CREATE'
    | 'TASK_UPDATE'
    | 'TASK_DELETE'
    | 'USER_REGISTERED'
    | 'USER_APPROVED'
    | 'USER_REJECTED'
    | 'USER_ROLE_CHANGED'
    | 'USER_ACTIVATED'
    | 'USER_DEACTIVATED';
  action_label: string;
  description: string;
  actor_name: string | null;
  actor_employee_id: string | null;
  subject_type: 'task' | 'user';
  subject_id: string;
  subject_label: string;
  subject_secondary: string | null;
  organization: string | null;
  occurred_at: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface AdminActivityFeed {
  source_counts: AdminActivitySourceCounts;
  action_counts: AdminActivityActionCounts;
  filtered_count: number;
  activities: AdminActivityLogItem[];
}

export type AdminUserAction =
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_ROLE_CHANGED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED';

export interface AdminUserActionPayload {
  user: UserListItem;
  action: AdminUserAction;
  audit_log_id: string | null;
}

export type AdminUserActionResult = ApiResult<AdminUserActionPayload>;

export const adminApi = {
  getDashboardSummary: async (): Promise<AdminDashboardSummary> => {
    return apiClient.get<AdminDashboardSummary>('/admin/dashboard/summary');
  },

  getActivityFeed: async (params?: {
    source?: AdminActivitySource;
    action?: AdminActivityAction;
    query?: string;
    limit?: number;
  }): Promise<AdminActivityFeed> => {
    const query = new URLSearchParams();
    if (params?.source && params.source !== 'all') query.set('source', params.source);
    if (params?.action && params.action !== 'all') query.set('action', params.action);
    if (params?.query?.trim()) query.set('query', params.query.trim());
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiClient.get<AdminActivityFeed>(`/admin/logs/activities${qs ? `?${qs}` : ''}`);
  },

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

  updateRole: async (userId: string, role: string): Promise<AdminUserActionResult> => {
    return apiClient.putWithMeta<AdminUserActionPayload>(`/admin/users/${userId}/role`, { role });
  },

  toggleActive: async (userId: string, isActive: boolean): Promise<AdminUserActionResult> => {
    return apiClient.putWithMeta<AdminUserActionPayload>(`/admin/users/${userId}/active`, {
      is_active: isActive,
    });
  },

  approvePendingUser: async (userId: string, role: 'viewer' | 'editor' | 'admin'): Promise<AdminUserActionResult> => {
    return apiClient.postWithMeta<AdminUserActionPayload>(`/admin/users/${userId}/approve`, { role });
  },

  rejectPendingUser: async (userId: string): Promise<AdminUserActionResult> => {
    return apiClient.postWithMeta<AdminUserActionPayload>(`/admin/users/${userId}/reject`);
  },
};
