import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Holding } from './portfolioStore';
import type { LineData } from 'lightweight-charts';

export interface SavedSession {
  id: string;
  name: string;
  createdAt: string;
  initialBalance: number;
  finalBalance: number;
  totalPnl: number;
  totalPnlPct: number;
  stockValue: number;
  cashBalance: number;
  holdings: Holding[];
  transactionCount: number;
  chartPoints: LineData[];
  aiSummary: string;
}

interface SessionHistoryState {
  sessions: SavedSession[];
  saveSession: (session: Omit<SavedSession, 'id' | 'createdAt'>) => void;
  deleteSession: (id: string) => void;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useSessionHistoryStore = create<SessionHistoryState>()(
  persist(
    (set, get) => ({
      sessions: [],

      saveSession: (session) => {
        const newSession: SavedSession = {
          ...session,
          id: uid(),
          createdAt: new Date().toISOString(),
        };
        set({ sessions: [newSession, ...get().sessions] });
      },

      deleteSession: (id) => {
        set({ sessions: get().sessions.filter((s) => s.id !== id) });
      },
    }),
    { name: 'monn-sessions' }
  )
);
