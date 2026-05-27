import { create } from 'zustand';

export interface Stock {
  symbol: string;
  name: string;
  market: 'HK' | 'US';
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  marketCap?: number;
  pe?: number;
}

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  buyPrice: number;
  quantity: number;
  buyDate: string;
  market: 'HK' | 'US';
}

export interface WatchlistGroup {
  id: string;
  name: string;
  stocks: string[];
}

export interface TradeNote {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  date: string;
  price: number;
  reason: string;
  tags: string[];
}

export interface AlertSetting {
  id: string;
  symbol: string;
  type: 'price_above' | 'price_below' | 'change_up' | 'change_down' | 'volume';
  value: number;
  enabled: boolean;
}

interface AppState {
  // Watchlist
  watchlistGroups: WatchlistGroup[];
  addWatchlistGroup: (name: string) => void;
  removeWatchlistGroup: (id: string) => void;
  addToWatchlist: (groupId: string, symbol: string) => void;
  removeFromWatchlist: (groupId: string, symbol: string) => void;

  // Simulated holdings
  holdings: Holding[];
  cashBalance: number;
  initialCapital: number;
  addHolding: (holding: Omit<Holding, 'id'>) => void;
  removeHolding: (id: string) => void;
  resetAccount: (capital: number) => void;

  // Trade notes
  tradeNotes: TradeNote[];
  addTradeNote: (note: Omit<TradeNote, 'id'>) => void;

  // Alerts
  alerts: AlertSetting[];
  addAlert: (alert: Omit<AlertSetting, 'id' | 'enabled'>) => void;
  toggleAlert: (id: string) => void;
  removeAlert: (id: string) => void;

  // Screener settings
  screenerConditions: Record<string, any>;
  setScreenerConditions: (conditions: Record<string, any>) => void;

  // Cross-page stock selection
  selectedStockSymbol: string;
  setSelectedStockSymbol: (symbol: string) => void;
}

let noteId = 0;
let alertId = 0;
let holdingId = 0;
let groupId = 0;

export const useStore = create<AppState>((set) => ({
  watchlistGroups: [
    { id: '1', name: '重点关注', stocks: ['00700', '09988', 'AAPL'] },
    { id: '2', name: '短线博弈', stocks: ['01810', 'NVDA'] },
    { id: '3', name: '长线价值', stocks: ['00388', 'MSFT'] },
  ],

  addWatchlistGroup: (name) =>
    set((state) => ({
      watchlistGroups: [
        ...state.watchlistGroups,
        { id: String(++groupId), name, stocks: [] },
      ],
    })),

  removeWatchlistGroup: (id) =>
    set((state) => ({
      watchlistGroups: state.watchlistGroups.filter((g) => g.id !== id),
    })),

  addToWatchlist: (groupId, symbol) =>
    set((state) => ({
      watchlistGroups: state.watchlistGroups.map((g) =>
        g.id === groupId && !g.stocks.includes(symbol)
          ? { ...g, stocks: [...g.stocks, symbol] }
          : g
      ),
    })),

  removeFromWatchlist: (groupId, symbol) =>
    set((state) => ({
      watchlistGroups: state.watchlistGroups.map((g) =>
        g.id === groupId ? { ...g, stocks: g.stocks.filter((s) => s !== symbol) } : g
      ),
    })),

  holdings: [
    { id: 'h1', symbol: '00700', name: 'Tencent', buyPrice: 320.5, quantity: 100, buyDate: '2024-01-15', market: 'HK' },
    { id: 'h2', symbol: 'AAPL', name: 'Apple', buyPrice: 175.0, quantity: 50, buyDate: '2024-03-10', market: 'US' },
  ],
  cashBalance: 500000,
  initialCapital: 1000000,

  addHolding: (h) =>
    set((state) => ({
      holdings: [...state.holdings, { ...h, id: `h${++holdingId}` }],
      cashBalance: state.cashBalance - h.buyPrice * h.quantity,
    })),

  removeHolding: (id) =>
    set((state) => {
      const holding = state.holdings.find((h) => h.id === id);
      return {
        holdings: state.holdings.filter((h) => h.id !== id),
        cashBalance: holding
          ? state.cashBalance + holding.buyPrice * holding.quantity
          : state.cashBalance,
      };
    }),

  resetAccount: (capital) =>
    set({ holdings: [], cashBalance: capital, initialCapital: capital }),

  tradeNotes: [],

  addTradeNote: (note) =>
    set((state) => ({
      tradeNotes: [...state.tradeNotes, { ...note, id: `n${++noteId}` }],
    })),

  alerts: [],

  addAlert: (alert) =>
    set((state) => ({
      alerts: [...state.alerts, { ...alert, id: `a${++alertId}`, enabled: true }],
    })),

  toggleAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      ),
    })),

  removeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    })),

  screenerConditions: {},

  setScreenerConditions: (conditions) =>
    set({ screenerConditions: conditions }),

  selectedStockSymbol: '00700',
  setSelectedStockSymbol: (symbol) => set({ selectedStockSymbol: symbol }),
}));
