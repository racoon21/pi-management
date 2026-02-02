import { create } from 'zustand';
import type { TaskGraphItem, TaskDetail } from '../types/task';
import { taskApi } from '../api';

interface TaskCreateData {
  parent_id: string | null;
  name: string;
  organization: string;
  team?: string | null;
  manager_name?: string | null;
  manager_id?: string | null;
  keywords?: string[];
  is_ai_utilized?: boolean;
}

interface TaskUpdateData {
  name?: string;
  organization?: string;
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

  // Actions
  fetchTasks: () => Promise<void>;
  setTasks: (tasks: TaskGraphItem[]) => void;
  selectTask: (taskId: string | null) => Promise<void>;
  toggleExpand: (nodeId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setFilters: (filters: Partial<TaskState['filters']>) => void;
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
      // Task 상세 조회 실패 시 tasks 배열에서 찾아서 대체
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

  createTask: async (data) => {
    try {
      const newTask = await taskApi.createTask({
        parent_id: data.parent_id,
        level: '', // 백엔드에서 자동 결정
        name: data.name,
        organization: data.organization,
        team: data.team || '',
        manager_name: data.manager_name || '',
        manager_id: data.manager_id || '',
        keywords: data.keywords || [],
        is_ai_utilized: data.is_ai_utilized || false,
      });

      // 서버에서 최신 데이터 다시 가져오기
      await get().fetchTasks();

      return newTask;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  },

  updateTask: async (taskId, updates) => {
    try {
      const updatedTask = await taskApi.updateTask(taskId, {
        name: updates.name,
        organization: updates.organization,
        team: updates.team || undefined,
        manager_name: updates.manager_name || undefined,
        manager_id: updates.manager_id || undefined,
        keywords: updates.keywords,
        is_ai_utilized: updates.is_ai_utilized,
      });

      // 서버에서 최신 데이터 다시 가져오기
      await get().fetchTasks();

      // 선택된 태스크도 업데이트
      if (get().selectedTaskId === taskId) {
        set({ selectedTask: updatedTask });
      }

      return updatedTask;
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  },

  deleteTask: async (taskId) => {
    try {
      await taskApi.deleteTask(taskId);

      // 선택 해제
      if (get().selectedTaskId === taskId) {
        set({ selectedTaskId: null, selectedTask: null });
      }

      // 서버에서 최신 데이터 다시 가져오기
      await get().fetchTasks();

      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw error;
    }
  },
}));
