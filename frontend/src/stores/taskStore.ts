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
  organization_name?: string | null;
  manager_name?: string | null;
  manager_id?: string | null;
  related_team?: string[] | null;
  keywords?: string[];
  is_ai_utilized?: boolean;
}

interface TaskUpdateData {
  name?: string;
  organization?: string;
  organization_type?: OrganizationType | null;
  organization_name?: string | null;
  manager_name?: string | null;
  manager_id?: string | null;
  related_team?: string[] | null;
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
    searchQuery: string | null;
  };
  /** [IMP-02] L1 포커스 뷰 */
  focusedL1Id: string | null;
  /** 마지막 fetch 시각 (중복 fetch 방지용) */
  _lastFetchedAt: number;

  // Actions
  invalidateCache: () => void;
  fetchTasks: (force?: boolean) => Promise<void>;
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
    searchQuery: null,
  },
  focusedL1Id: null,
  _lastFetchedAt: 0,

  invalidateCache: () => {
    set({ _lastFetchedAt: 0 });
  },

  fetchTasks: async (force = false) => {
    // 60초 이내 재호출 방지 (force=true 시 무시)
    const { tasks, _lastFetchedAt } = get();
    if (!force && tasks.length > 0 && Date.now() - _lastFetchedAt < 60_000) return;

    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const fetched = await taskApi.getGraph({
        organization: filters.organization || undefined,
        level: filters.level || undefined,
        is_ai_utilized: filters.isAiUtilized ?? undefined,
      });
      set({ tasks: fetched, isLoading: false, _lastFetchedAt: Date.now() });
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
        organization_name: data.organization_name || '',
        manager_name: data.manager_name || '',
        manager_id: data.manager_id || '',
        related_team: data.related_team || null,
        keywords: data.keywords || [],
        is_ai_utilized: data.is_ai_utilized || false,
      });

      // 낙관적 업데이트: 로컬 배열에 즉시 추가
      const graphItem: TaskGraphItem = {
        id: newTask.id,
        parent_id: newTask.parent_id,
        level: newTask.level,
        name: newTask.name,
        organization: newTask.organization,
        organization_type: newTask.organization_type,
        organization_name: newTask.organization_name,
        manager_name: newTask.manager_name,
        manager_id: newTask.manager_id,
        related_team: newTask.related_team,
        keywords: newTask.keywords,
        is_ai_utilized: newTask.is_ai_utilized,
      };
      set((state) => ({
        tasks: [...state.tasks, graphItem],
        _lastFetchedAt: Date.now(),
      }));

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
        organization_name: updates.organization_name || undefined,
        manager_name: updates.manager_name || undefined,
        manager_id: updates.manager_id || undefined,
        related_team: updates.related_team,
        keywords: updates.keywords,
        is_ai_utilized: updates.is_ai_utilized,
      });

      // 낙관적 업데이트: 로컬 배열에서 해당 항목 교체
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                name: updatedTask.name,
                organization: updatedTask.organization,
                organization_type: updatedTask.organization_type,
                organization_name: updatedTask.organization_name,
                manager_name: updatedTask.manager_name,
                manager_id: updatedTask.manager_id,
                related_team: updatedTask.related_team,
                keywords: updatedTask.keywords,
                is_ai_utilized: updatedTask.is_ai_utilized,
              }
            : t
        ),
        selectedTask: state.selectedTaskId === taskId ? updatedTask : state.selectedTask,
        _lastFetchedAt: Date.now(),
      }));

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

      // 낙관적 업데이트: 로컬 배열에서 해당 항목 제거
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
        selectedTask: state.selectedTaskId === taskId ? null : state.selectedTask,
        _lastFetchedAt: Date.now(),
      }));

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
