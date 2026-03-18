import { create } from 'zustand';
import type { TaskGraphItem, TaskDetail, OrganizationType } from '../types/task';
import { taskApi } from '../api';
import { ApiError } from '../api/client';
import toast from 'react-hot-toast';

interface TaskCreateData {
  parent_id: string | null;
  name: string;
  organization: string;
  organization_type?: OrganizationType | null;
  team?: string | null;
  manager_name?: string | null;
  manager_id?: string | null;
  keywords?: string[];
  is_ai_utilized?: boolean;
}

interface TaskUpdateData {
  name?: string;
  organization?: string;
  organization_type?: OrganizationType | null;
  team?: string | null;
  manager_name?: string | null;
  manager_id?: string | null;
  keywords?: string[];
  is_ai_utilized?: boolean;
}

interface TaskState {
  tasks: TaskGraphItem[];
  selectedTaskId: string | null;
  selectedTask: TaskDetail | null;
  expandedNodes: Set<string>;
  isLoading: boolean;
  error: string | null;
  filters: {
    organization: string | null;
    level: string | null;
    isAiUtilized: boolean | null;
  };
  /** [IMP-02] L1 포커스 뷰 */
  focusedL1Id: string | null;

  // Actions
  fetchTasks: () => Promise<void>;
  setTasks: (tasks: TaskGraphItem[]) => void;
  selectTask: (taskId: string | null) => Promise<void>;
  toggleExpand: (nodeId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setFilters: (filters: Partial<TaskState['filters']>) => void;
  setFocusedL1: (id: string | null) => void;
  createTask: (data: TaskCreateData) => Promise<TaskDetail | null>;
  updateTask: (taskId: string, updates: TaskUpdateData) => Promise<TaskDetail | null>;
  deleteTask: (taskId: string) => Promise<boolean>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  selectedTask: null,
  expandedNodes: new Set(),
  isLoading: false,
  error: null,
  filters: {
    organization: null,
    level: null,
    isAiUtilized: null,
  },
  focusedL1Id: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const tasks = await taskApi.getGraph({
        organization: filters.organization || undefined,
        level: filters.level || undefined,
        is_ai_utilized: filters.isAiUtilized ?? undefined,
      });
      set({ tasks, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      set({ error: 'Failed to fetch tasks', isLoading: false });
    }
  },

  setTasks: (tasks) => set({ tasks }),

  selectTask: async (taskId) => {
    if (!taskId) {
      set({ selectedTaskId: null, selectedTask: null });
      return;
    }

    set({ selectedTaskId: taskId });

    try {
      const selectedTask = await taskApi.getTask(taskId);
      set({ selectedTask });
    } catch (error) {
      console.error('Failed to fetch task detail:', error);
      const task = get().tasks.find(t => t.id === taskId);
      if (task) {
        set({
          selectedTask: {
            ...task,
            version: 1,
            created_by: '',
            updated_by: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as TaskDetail
        });
      } else {
        set({ selectedTask: null });
      }
    }
  },

  toggleExpand: (nodeId) => {
    const { tasks, expandedNodes: currentExpanded } = get();

    if (currentExpanded.has(nodeId)) {
      const newExpanded = new Set<string>();
      const task = tasks.find(t => t.id === nodeId);
      if (task) {
        let current = task;
        while (current.parent_id) {
          newExpanded.add(current.parent_id);
          const parent = tasks.find(t => t.id === current.parent_id);
          if (!parent) break;
          current = parent;
        }
      }
      set({ expandedNodes: newExpanded });
    } else {
      const newExpanded = new Set<string>();
      newExpanded.add(nodeId);

      const task = tasks.find(t => t.id === nodeId);
      if (task) {
        let current = task;
        while (current.parent_id) {
          newExpanded.add(current.parent_id);
          const parent = tasks.find(t => t.id === current.parent_id);
          if (!parent) break;
          current = parent;
        }
      }
      set({ expandedNodes: newExpanded });
    }
  },

  expandAll: () => {
    const allIds = get().tasks.map(t => t.id);
    set({ expandedNodes: new Set(allIds) });
  },

  collapseAll: () => {
    const rootId = get().tasks.find(t => t.level === 'Root')?.id;
    set({ expandedNodes: new Set(rootId ? [rootId] : []) });
  },

  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters },
  })),

  /** [IMP-02] L1 포커스 설정 시 하위 노드 자동 확장 */
  setFocusedL1: (id) => {
    if (!id) {
      set({ focusedL1Id: null });
      return;
    }
    const { tasks } = get();
    // 해당 L1과 모든 하위 노드를 expandedNodes에 추가
    const idsToExpand = new Set<string>();
    const rootTask = tasks.find(t => t.level === 'Root');
    if (rootTask) idsToExpand.add(rootTask.id);
    idsToExpand.add(id);

    // BFS로 하위 노드 수집
    const queue = [id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = tasks.filter(t => t.parent_id === current);
      for (const child of children) {
        idsToExpand.add(child.id);
        queue.push(child.id);
      }
    }

    set({ focusedL1Id: id, expandedNodes: idsToExpand });
  },

  createTask: async (data) => {
    try {
      const newTask = await taskApi.createTask({
        parent_id: data.parent_id,
        level: '', // 백엔드에서 자동 결정
        name: data.name,
        organization: data.organization,
        organization_type: data.organization_type,
        team: data.team || '',
        manager_name: data.manager_name || '',
        manager_id: data.manager_id || '',
        keywords: data.keywords || [],
        is_ai_utilized: data.is_ai_utilized || false,
      });

      await get().fetchTasks();
      return newTask;
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error('권한이 없습니다. 관리자에게 문의하세요.');
      }
      console.error('Failed to create task:', error);
      throw error;
    }
  },

  updateTask: async (taskId, updates) => {
    try {
      const updatedTask = await taskApi.updateTask(taskId, {
        name: updates.name,
        organization: updates.organization,
        organization_type: updates.organization_type,
        team: updates.team || undefined,
        manager_name: updates.manager_name || undefined,
        manager_id: updates.manager_id || undefined,
        keywords: updates.keywords,
        is_ai_utilized: updates.is_ai_utilized,
      });

      await get().fetchTasks();

      if (get().selectedTaskId === taskId) {
        set({ selectedTask: updatedTask });
      }

      return updatedTask;
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error('권한이 없습니다. 관리자에게 문의하세요.');
      }
      console.error('Failed to update task:', error);
      throw error;
    }
  },

  deleteTask: async (taskId) => {
    try {
      await taskApi.deleteTask(taskId);

      if (get().selectedTaskId === taskId) {
        set({ selectedTaskId: null, selectedTask: null });
      }

      await get().fetchTasks();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error('권한이 없습니다. 관리자에게 문의하세요.');
      }
      console.error('Failed to delete task:', error);
      throw error;
    }
  },
}));
