export type TaskLevel = 'Root' | 'L1' | 'L2' | 'L3' | 'L4';

export interface TaskGraphItem {
  id: string;
  parent_id: string | null;
  level: TaskLevel;
  name: string;
  organization: string;
  team: string | null;
  manager_name: string | null;
  manager_id: string | null;
  keywords: string[];
  is_ai_utilized: boolean;
}

export interface TaskDetail extends TaskGraphItem {
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  snapshot: TaskDetail;
  version: number;
  change_type: 'CREATE' | 'UPDATE' | 'DELETE';
  changed_by: string | null;
  changed_by_name: string | null;  // 수정자 이름
  changed_at: string;
}

export interface TaskCreate {
  parent_id: string | null;
  name: string;
  organization: string;
  team?: string;
  manager_name?: string;
  manager_id?: string;
  keywords?: string[];
  is_ai_utilized?: boolean;
}

export interface TaskUpdate {
  name?: string;
  organization?: string;
  team?: string;
  manager_name?: string;
  manager_id?: string;
  keywords?: string[];
  is_ai_utilized?: boolean;
}

export interface User {
  id: string;
  employee_id: string;
  name: string;
  organization: string;
  role: 'admin' | 'editor' | 'viewer';
}
