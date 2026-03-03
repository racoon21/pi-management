const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ExcelRow {
  l1: string;
  l2: string;
  l3: string;
  l4: string;
}

export interface HierarchyNode {
  name: string;
  level: string;
  children: HierarchyNode[];
}

export interface UploadPreview {
  rows: ExcelRow[];
  total_rows: number;
  summary: {
    l1_count: number;
    l2_count: number;
    l3_count: number;
    l4_count: number;
  };
  hierarchy: HierarchyNode[];
}

export interface DiffNode {
  name: string;
  level: string;
  status: 'new' | 'existing';
  children: DiffNode[];
}

export interface DiffResult {
  diff_tree: DiffNode[];
  stats: {
    new: number;
    existing: number;
    total: number;
  };
}

export interface UpsertResult {
  created: number;
  skipped: number;
  total: number;
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.state?.accessToken || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function handleUnauthorized(): never {
  localStorage.removeItem('auth-storage');
  window.location.href = '/login';
  throw new Error('Unauthorized');
}

async function uploadRequest<T>(endpoint: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (response.status === 401) {
    handleUnauthorized();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Network error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const result: ApiResponse<T> = await response.json();
  return result.data;
}

export const uploadApi = {
  preview: (file: File) => uploadRequest<UploadPreview>('/upload/preview', file),
  diff: (file: File) => uploadRequest<DiffResult>('/upload/diff', file),
  confirm: (file: File) => uploadRequest<UpsertResult>('/upload/confirm', file),
};
