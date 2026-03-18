import type { User } from '../types/task';

export const permissions = {
  canCreateTask: (user: User | null) => user?.role === 'admin' || user?.role === 'editor',
  canEditTask: (user: User | null) => user?.role === 'admin' || user?.role === 'editor',
  canDeleteTask: (user: User | null) => user?.role === 'admin',
  canUpload: (user: User | null) => user?.role === 'admin' || user?.role === 'editor',
  isAdmin: (user: User | null) => user?.role === 'admin',
};
