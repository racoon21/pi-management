import { apiClient } from './client';
import type { TaskGraphItem, TaskDetail, TaskHistory, OrganizationType } from '../types/task';

interface TaskFilters {
  organization?: string;
  level?: string;
  is_ai_utilized?: boolean;
}

interface TaskCreateRequest {
  parent_id: string | null;
  level: string;
  name: string;
  organization: string;
  organization_type?: OrganizationType | null;
  team: string;
  manager_name: string;
  manager_id: string;
  related_team?: string[] | null;
  keywords: string[];
  is_ai_utilized: boolean;
}

interface TaskUpdateRequest {
  name?: string;
  organization?: string;
  organization_type?: OrganizationType | null;
  team?: string;
  manager_name?: string;
  manager_id?: string;
  related_team?: string[] | null;
  keywords?: string[];
  is_ai_utilized?: boolean;
}

export const taskApi = {
  getGraph: async (filters?: TaskFilters): Promise<TaskGraphItem[]> => {
    const params = new URLSearchParams();
    if (filters?.organization) params.append('organization', filters.organization);
    if (filters?.level) params.append('level', filters.level);
    if (filters?.is_ai_utilized !== undefined) {
      params.append('is_ai_utilized', String(filters.is_ai_utilized));
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<TaskGraphItem[]>(`/tasks/graph${query}`);
  },

  getTask: async (taskId: string): Promise<TaskDetail> => {
    return apiClient.get<TaskDetail>(`/tasks/${taskId}`);
  },

  createTask: async (data: TaskCreateRequest): Promise<TaskDetail> => {
    return apiClient.post<TaskDetail>('/tasks', data);
  },

  updateTask: async (taskId: string, data: TaskUpdateRequest): Promise<TaskDetail> => {
    return apiClient.put<TaskDetail>(`/tasks/${taskId}`, data);
  },

  deleteTask: async (taskId: string): Promise<boolean> => {
    return apiClient.delete<boolean>(`/tasks/${taskId}`);
  },

  getHistory: async (taskId: string): Promise<TaskHistory[]> => {
    return apiClient.get<TaskHistory[]>(`/tasks/${taskId}/history`);
  },

  /** [IMP-07] 하위 노드 조회 (cascade 삭제 확인용) */
  getDescendants: async (taskId: string): Promise<TaskGraphItem[]> => {
    return apiClient.get<TaskGraphItem[]>(`/tasks/${taskId}/descendants`);
  },

  /** 연결 업무 조회 */
  getRelations: async (taskId: string): Promise<TaskGraphItem[]> => {
    return apiClient.get<TaskGraphItem[]>(`/tasks/${taskId}/relations`);
  },

  /** 연결 업무 추가 */
  addRelation: async (taskId: string, relatedTaskId: string): Promise<boolean> => {
    return apiClient.post<boolean>(`/tasks/${taskId}/relations`, { related_task_id: relatedTaskId });
  },

  /** 연결 업무 삭제 */
  removeRelation: async (taskId: string, relatedId: string): Promise<boolean> => {
    return apiClient.delete<boolean>(`/tasks/${taskId}/relations/${relatedId}`);
  },

  /** 태스크 검색 */
  searchTasks: async (query: string): Promise<TaskGraphItem[]> => {
    return apiClient.get<TaskGraphItem[]>(`/tasks/search/query?q=${encodeURIComponent(query)}`);
  },
};
