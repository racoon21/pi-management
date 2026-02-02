import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/task';
import { authApi } from '../api';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (employeeId: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User) => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      login: async (employeeId: string, password: string) => {
        try {
          const tokens = await authApi.login(employeeId, password);

          set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            isAuthenticated: true,
          });

          // 로그인 후 유저 정보 가져오기
          await get().fetchUser();

          return true;
        } catch (error) {
          console.error('Login failed:', error);
          return false;
        }
      },

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        });
      },

      setUser: (user) => set({ user }),

      fetchUser: async () => {
        try {
          const user = await authApi.getMe();
          set({ user });
        } catch (error) {
          console.error('Failed to fetch user:', error);
          // 토큰이 유효하지 않으면 로그아웃
          get().logout();
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
