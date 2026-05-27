import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Holding {
  symbol: string;
  shares: number;
  avgCost: number;
}

export interface Transaction {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'deposit' | 'withdraw';
  shares: number;
  price: number;
  total: number;
  timestamp: string;
}

interface PortfolioState {
  balance: number;
  totalDeposited: number;
  holdings: Holding[];
  transactions: Transaction[];
  userId: string | null;
  initUser: (userId: string) => void;
  buy: (symbol: string, shares: number, price: number) => boolean;
  sell: (symbol: string, shares: number, price: number) => boolean;
  deposit: (amount: number) => void;
  withdraw: (amount: number) => boolean;
  getHolding: (symbol: string) => Holding | undefined;
  resetPortfolio: () => void;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const DEFAULT_BALANCE = 1_000_000; // 100万初始资金

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      balance: DEFAULT_BALANCE,
      totalDeposited: DEFAULT_BALANCE,
      holdings: [],
      transactions: [],
      userId: null,

      initUser: (userId: string) => {
        const s = get();
        if (s.userId !== userId) {
          set({ userId, balance: DEFAULT_BALANCE, totalDeposited: DEFAULT_BALANCE, holdings: [], transactions: [] });
        }
      },

      deposit: (amount: number) => {
        if (amount <= 0) return;
        const s = get();
        const txn: Transaction = {
          id: uid(), symbol: '', type: 'deposit', shares: 0, price: 0,
          total: amount, timestamp: new Date().toISOString(),
        };
        set({
          balance: s.balance + amount,
          totalDeposited: s.totalDeposited + amount,
          transactions: [txn, ...s.transactions],
        });
      },

      withdraw: (amount: number) => {
        if (amount <= 0) return false;
        const s = get();
        if (amount > s.balance) return false;
        const txn: Transaction = {
          id: uid(), symbol: '', type: 'withdraw', shares: 0, price: 0,
          total: amount, timestamp: new Date().toISOString(),
        };
        set({
          balance: s.balance - amount,
          totalDeposited: s.totalDeposited - amount,
          transactions: [txn, ...s.transactions],
        });
        return true;
      },

      buy: (symbol: string, shares: number, price: number) => {
        if (!symbol || shares <= 0 || price <= 0) return false;
        const s = get();
        const isHK = /^\d{5}$/.test(symbol);
        const total = shares * price;
        // HK: ~0.10835% (stamp 0.1% + levy 0.0027% + trading fee 0.00565%)
        // US: ~0.00229% SEC fee
        const fee = isHK ? total * 0.0010835 : total * 0.0000229;
        const totalCost = total + fee;
        if (totalCost > s.balance) return false;

        const txn: Transaction = {
          id: uid(),
          symbol,
          type: 'buy',
          shares,
          price,
          total: totalCost,
          timestamp: new Date().toISOString(),
        };

        const existing = s.holdings.find((h) => h.symbol === symbol);
        if (existing) {
          const totalShares = existing.shares + shares;
          const newAvgCost = (existing.shares * existing.avgCost + totalCost) / totalShares;
          set({
            balance: s.balance - totalCost,
            holdings: s.holdings.map((h) =>
              h.symbol === symbol ? { ...h, shares: totalShares, avgCost: +newAvgCost.toFixed(3) } : h
            ),
            transactions: [txn, ...s.transactions],
          });
        } else {
          set({
            balance: s.balance - totalCost,
            holdings: [...s.holdings, { symbol, shares, avgCost: +(totalCost / shares).toFixed(3) }],
            transactions: [txn, ...s.transactions],
          });
        }
        return true;
      },

      sell: (symbol: string, shares: number, price: number) => {
        if (!symbol || shares <= 0 || price <= 0) return false;
        const s = get();
        const h = s.holdings.find((x) => x.symbol === symbol);
        if (!h || h.shares < shares) return false;

        const isHK = /^\d{5}$/.test(symbol);
        const total = shares * price;
        // HK: ~0.10835% (stamp 0.1% + levy 0.0027% + trading fee 0.00565%)
        // US: ~0.00229% SEC fee
        const fee = isHK ? total * 0.0010835 : total * 0.0000229;
        const netProceeds = total - fee;

        const txn: Transaction = {
          id: uid(),
          symbol,
          type: 'sell',
          shares,
          price,
          total: netProceeds,
          timestamp: new Date().toISOString(),
        };

        const remaining = h.shares - shares;
        if (remaining <= 0) {
          set({
            balance: s.balance + netProceeds,
            holdings: s.holdings.filter((x) => x.symbol !== symbol),
            transactions: [txn, ...s.transactions],
          });
        } else {
          set({
            balance: s.balance + netProceeds,
            holdings: s.holdings.map((x) =>
              x.symbol === symbol ? { ...x, shares: remaining } : x
            ),
            transactions: [txn, ...s.transactions],
          });
        }
        return true;
      },

      getHolding: (symbol: string) => get().holdings.find((h) => h.symbol === symbol),

      resetPortfolio: () => set({ balance: DEFAULT_BALANCE, totalDeposited: DEFAULT_BALANCE, holdings: [], transactions: [] }),
    }),
    { name: 'monn-portfolio' }
  )
);
