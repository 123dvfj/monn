import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TriggerType = 'market_open' | 'price_le' | 'price_ge';

export interface ConditionalOrder {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  shares: number;
  triggerType: TriggerType;
  triggerPrice: number; // 0 for market_open
  createdAt: string;
  status: 'pending' | 'executed' | 'cancelled';
  executedAt?: string;
  executedPrice?: number;
}

interface ConditionalOrderState {
  orders: ConditionalOrder[];
  addOrder: (order: Omit<ConditionalOrder, 'id' | 'createdAt' | 'status'>) => void;
  cancelOrder: (id: string) => void;
  markExecuted: (id: string, executedPrice: number) => void;
  getPendingOrders: () => ConditionalOrder[];
  resetOrders: () => void;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useConditionalOrderStore = create<ConditionalOrderState>()(
  persist(
    (set, get) => ({
      orders: [],

      addOrder: (order) => {
        if (!order.symbol || order.shares <= 0) return;
        if (order.triggerType !== 'market_open' && order.triggerPrice <= 0) return;
        const newOrder: ConditionalOrder = {
          ...order,
          id: uid(),
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        set({ orders: [newOrder, ...get().orders] });
      },

      cancelOrder: (id) => {
        set({
          orders: get().orders.map((o) =>
            o.id === id ? { ...o, status: 'cancelled' as const } : o
          ),
        });
      },

      markExecuted: (id, executedPrice) => {
        const order = get().orders.find((o) => o.id === id);
        if (!order || order.status !== 'pending') return;
        set({
          orders: get().orders.map((o) =>
            o.id === id
              ? { ...o, status: 'executed' as const, executedAt: new Date().toISOString(), executedPrice }
              : o
          ),
        });
      },

      getPendingOrders: () => get().orders.filter((o) => o.status === 'pending'),

      resetOrders: () => set({ orders: [] }),
    }),
    { name: 'monn-conditional-orders' }
  )
);
