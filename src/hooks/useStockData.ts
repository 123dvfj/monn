import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchQuotes, fetchChart, fetchNews, searchStocks,
  cachedFetch, type YQuote, type YCandle, type YNewsItem,
} from '../services/yahooFinance';

// ---- Key stock pools ----
export const INDEX_SYMBOLS = ['HSI', 'HSCEI', 'HSTECH', 'DJI', 'IXIC', 'SPX'];

export const ALL_HK_STOCKS = [
  // Tech & Internet
  '00700', '09988', '01810', '03690', '09999', '09618', '01024', '09888', '09901', '09626',
  '02015', '06618', '00780', '00670', '06186', '03888', '00772', '00823',
  // Finance
  '00388', '01299', '02318', '02628', '01398', '03988', '00939', '00005', '00011', '02388',
  '01658', '06818', '06030', '03968',
  // Property
  '00016', '01109', '00688', '00823', '00012', '00017', '00883',
  // Energy & Resources
  '00883', '00857', '00386', '01088', '01171', '01898',
  // Consumer & Retail
  '09633', '02020', '09688', '02331', '01929', '06110', '09698', '01876',
  // Healthcare
  '02269', '01177', '01801', '06098', '00992', '02196',
  // Auto & New Energy
  '01211', '09868', '02015', '09863', '00175', '02238', '01268',
  // Industrial
  '00316', '02382', '00669', '02018', '01347',
  // Infrastructure
  '00002', '00003', '00006', '00066', '00267',
  // Others
  '00027', '01928', '06862', '09987', '02518',
];

export const ALL_US_STOCKS = [
  // Big Tech (Magnificent 7)
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  // Semiconductors
  'AMD', 'INTC', 'QCOM', 'AVGO', 'TXN', 'MU', 'AMAT', 'LRCX', 'ASML',
  // Software & Cloud
  'ADBE', 'CRM', 'ORCL', 'NOW', 'SNOW', 'DDOG', 'CRWD', 'ZS', 'NET', 'MDB',
  // Fintech & Payments
  'V', 'MA', 'PYPL', 'SQ', 'COIN', 'AFRM', 'SOFI',
  // E-commerce & Social
  'BABA', 'JD', 'PDD', 'SHOP', 'SNAP', 'PINS', 'U',
  // AI & Data
  'PLTR', 'AI', 'PATH', 'CFLT', 'ESTC',
  // EV & Auto
  'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'F', 'GM',
  // Finance
  'JPM', 'GS', 'BAC', 'C', 'WFC', 'MS', 'BLK', 'SCHW',
  // Healthcare
  'JNJ', 'PFE', 'MRNA', 'UNH', 'ABBV', 'LLY', 'ISRG', 'DXCM',
  // Consumer
  'AMZN', 'COST', 'WMT', 'NKE', 'SBUX', 'MCD', 'DIS',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'OXY',
  // Telecom & Media
  'T', 'VZ', 'TMUS', 'NFLX', 'SPOT',
  // Aerospace & Defense
  'BA', 'LMT', 'RTX', 'SPCE',
  // Others
  'UBER', 'ABNB', 'SNAP', 'HOOD', 'RBLX',
];

// Default display sets (subset for performance)
export const DEFAULT_HK_STOCKS = ALL_HK_STOCKS.slice(0, 30);
export const DEFAULT_US_STOCKS = ALL_US_STOCKS.slice(0, 30);

// ---- useQuotes: periodic real-time quotes ----
export function useQuotes(symbols: string[], intervalMs: number = 30_000) {
  const [quotes, setQuotes] = useState<YQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const symbolsKey = symbols.join(',');

  const load = useCallback(async () => {
    if (symbols.length === 0) return;
    try {
      setLoading(true);
      const data = await cachedFetch(
        `quotes:${symbolsKey}`,
        () => fetchQuotes(symbols),
        15_000
      );
      setQuotes(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [symbolsKey]);

  useEffect(() => {
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { quotes, loading, error, refresh: load };
}

// ---- useChart: historical K-line data ----
export function useChart(symbol: string, range: string = '6mo', interval: string = '1d') {
  const [candles, setCandles] = useState<YCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const key = `chart:${symbol}:${range}:${interval}`;
    cachedFetch(key, () => fetchChart(symbol, range, interval), 300_000)
      .then((data) => {
        if (!cancelled) { setCandles(data); setError(null); }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, range, interval]);

  return { candles, loading, error };
}

// ---- useNews: news feed ----
export function useNews(symbols: string[] = [], count: number = 20) {
  const [news, setNews] = useState<YNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const key = `news:${symbols.join(',')}:${count}`;
    cachedFetch(key, () => fetchNews(symbols, count), 120_000)
      .then((data) => { if (!cancelled) setNews(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbols.join(','), count]);

  return { news, loading };
}

// ---- useSearch: stock search ----
export function useSearch() {
  const [results, setResults] = useState<YQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await cachedFetch(`search:${query}`, () => searchStocks(query), 60_000);
        setResults(data);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, []);

  return { results, loading, search };
}
