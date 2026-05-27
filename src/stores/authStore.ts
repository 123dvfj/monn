import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API = 'http://localhost:3001/api';

export interface User {
  id: number;
  username: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoggedIn: false,
      loading: false,
      error: null,

      login: async (username, password) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            set({ loading: false, error: data.error });
            return false;
          }
          set({ user: data.user, isLoggedIn: true, loading: false });
          return true;
        } catch {
          set({ loading: false, error: '无法连接服务器' });
          return false;
        }
      },

      register: async (username, password) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`${API}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            set({ loading: false, error: data.error });
            return false;
          }
          set({ user: data.user, isLoggedIn: true, loading: false });
          return true;
        } catch {
          set({ loading: false, error: '无法连接服务器' });
          return false;
        }
      },

      logout: () => set({ user: null, isLoggedIn: false }),

      clearError: () => set({ error: null }),
    }),
    { name: 'monn-auth' }
  )
);
