import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchQuotes, fetchChart, fetchNews, searchStocks,
  cachedFetch, type YQuote, type YCandle, type YNewsItem,
} from '../services/yahooFinance';

// ---- Key stock pools ----
export const INDEX_SYMBOLS = ['HSI', 'HSCEI', 'HSTECH', 'DJI', 'IXIC', 'SPX'];
export const DEFAULT_HK_STOCKS = ['00700', '09988', '01810', '00388', '09618', '01211', '02269', '03690', '09999', '01024'];
export const DEFAULT_US_STOCKS = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'GOOGL', 'AMZN', 'META', 'AMD', 'NFLX', 'BABA'];

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
