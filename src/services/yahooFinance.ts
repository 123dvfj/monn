// Yahoo Finance data service
// Uses v8/finance/chart endpoint (v7/quote is blocked by Yahoo)
// Proxy handled by Vite middleware in dev mode

const isDev = typeof window !== 'undefined' && window.location.port === '5173';

function apiUrl(path: string): string {
  if (isDev) return `/api/yahoo${path}`;
  return `https://query1.finance.yahoo.com${path}`;
}

function newsApiUrl(path: string): string {
  if (isDev) return `/api/yahoo-news${path}`;
  return `https://query2.finance.yahoo.com${path}`;
}

// ---- Symbol conversion ----
const HK_MAP: Record<string, string> = {
  '00700': '0700.HK', '09988': '9988.HK', '01810': '1810.HK',
  '00388': '0388.HK', '09618': '9618.HK', '01211': '1211.HK',
  '02269': '2269.HK', '00016': '0016.HK', '00005': '0005.HK',
  '02318': '2318.HK', '00941': '0941.HK', '03690': '3690.HK',
};

const INDEX_MAP: Record<string, string> = {
  'HSI': '^HSI', 'HSCEI': '^HSCE', 'HSTECH': '^HSTECH',
  'DJI': '^DJI', 'IXIC': '^IXIC', 'SPX': '^GSPC',
};

export function toYahooSymbol(sym: string): string {
  if (INDEX_MAP[sym]) return INDEX_MAP[sym];
  if (HK_MAP[sym]) return HK_MAP[sym];
  if (/^\d{5}$/.test(sym)) {
    const num = parseInt(sym, 10);
    return `${String(num).padStart(4, '0')}.HK`;
  }
  return sym;
}

function fromYahooSymbol(ys: string): string {
  for (const [k, v] of Object.entries(INDEX_MAP)) { if (v === ys) return k; }
  for (const [k, v] of Object.entries(HK_MAP)) { if (v === ys) return k; }
  const m = ys.match(/^(\d{1,4})\.HK$/);
  if (m) return m[1].padStart(5, '0');
  return ys;
}

// ---- Types ----
export interface YQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketOpen: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  averageDailyVolume3Month?: number;
  currency?: string;
  exchangeName?: string;
}

export interface YCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YNewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: string;
  summary?: string;
  thumbnail?: string;
}

// ---- API calls ----

async function yahooFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Yahoo API error: ${res.status}`);
  return res.json();
}

// Fetch quotes using v8/chart endpoint (v7/quote is blocked)
export async function fetchQuotes(symbols: string[]): Promise<YQuote[]> {
  if (symbols.length === 0) return [];

  // Fetch each symbol's 1d chart to get meta quote data
  const results = await Promise.allSettled(
    symbols.map(async (sym) => {
      const ys = toYahooSymbol(sym);
      const data = await yahooFetch<any>(apiUrl(`/v8/finance/chart/${encodeURIComponent(ys)}?range=1d&interval=5m`));
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) return null;

      const price = meta.regularMarketPrice ?? 0;
      const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol: fromYahooSymbol(meta.symbol ?? ys),
        shortName: meta.shortName ?? meta.symbol ?? '',
        longName: meta.longName ?? '',
        regularMarketPrice: price,
        regularMarketChange: change,
        regularMarketChangePercent: changePct,
        regularMarketOpen: meta.regularMarketOpen ?? prevClose,
        regularMarketDayHigh: meta.regularMarketDayHigh ?? price,
        regularMarketDayLow: meta.regularMarketDayLow ?? price,
        regularMarketVolume: meta.regularMarketVolume ?? 0,
        regularMarketPreviousClose: prevClose,
        marketCap: meta.marketCap,
        trailingPE: meta.trailingPE,
        forwardPE: meta.forwardPE,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        currency: meta.currency,
        exchangeName: meta.exchangeName,
      } as YQuote;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<YQuote | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((q): q is YQuote => q !== null && q.regularMarketPrice > 0);
}

export async function fetchChart(
  symbol: string,
  range: string = '6mo',
  interval: string = '1d'
): Promise<YCandle[]> {
  const ys = toYahooSymbol(symbol);
  const data = await yahooFetch<any>(
    apiUrl(`/v8/finance/chart/${encodeURIComponent(ys)}?range=${range}&interval=${interval}`)
  );
  const result = data?.chart?.result?.[0];
  if (!result) return [];

  const timestamps: number[] = result.timestamp ?? [];
  const quote: any = result.indicators?.quote?.[0] ?? {};
  const opens: (number | null)[] = quote.open ?? [];
  const highs: (number | null)[] = quote.high ?? [];
  const lows: (number | null)[] = quote.low ?? [];
  const closes: (number | null)[] = quote.close ?? [];
  const volumes: (number | null)[] = quote.volume ?? [];

  return timestamps.map((ts: number, i: number) => ({
    time: new Date(ts * 1000).toISOString().split('T')[0],
    open: Number(opens[i]?.toFixed(2) || 0),
    high: Number(highs[i]?.toFixed(2) || 0),
    low: Number(lows[i]?.toFixed(2) || 0),
    close: Number(closes[i]?.toFixed(2) || 0),
    volume: volumes[i] ?? 0,
  })).filter((c: YCandle) => c.open > 0 && c.close > 0);
}

export async function searchStocks(query: string): Promise<YQuote[]> {
  try {
    const data = await yahooFetch<any>(apiUrl(`/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10`));
    const quotes = data?.quotes ?? [];
    return quotes
      .filter((q: any) => q.quoteType === 'EQUITY')
      .map((q: any) => ({
        symbol: fromYahooSymbol(q.symbol ?? ''),
        shortName: q.shortname ?? q.longname ?? '',
        longName: q.longname ?? '',
        regularMarketPrice: 0,
        regularMarketChange: 0,
        regularMarketChangePercent: 0,
        regularMarketOpen: 0,
        regularMarketDayHigh: 0,
        regularMarketDayLow: 0,
        regularMarketVolume: 0,
        regularMarketPreviousClose: 0,
        exchangeName: q.exchange,
      }));
  } catch {
    return [];
  }
}

export async function fetchNews(symbols: string[] = [], count: number = 20): Promise<YNewsItem[]> {
  try {
    const ys = symbols.map(toYahooSymbol);
    const url = ys.length > 0
      ? newsApiUrl(`/v1/finance/news?symbols=${ys.join(',')}&count=${count}`)
      : newsApiUrl(`/v1/finance/news?count=${count}`);
    const data = await yahooFetch<any>(url);
    return (data?.items ?? data?.result ?? []).slice(0, count).map((n: any) => ({
      title: n.title ?? '',
      link: n.link ?? n.canonicalUrl?.url ?? '',
      publisher: n.publisher ?? '',
      publishedAt: n.pubDate ?? n.publishedAt ?? '',
      summary: n.summary ?? '',
      thumbnail: n.thumbnail ?? '',
    }));
  } catch {
    return [];
  }
}

// ---- Cache ----
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = {
  quote: 30_000,
  chart: 300_000,
  news: 120_000,
};

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.quote
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttl) return hit.data;
  const data = await fetcher();
  cache.set(key, { data, ts: Date.now() });
  return data;
}

export function clearCache() {
  cache.clear();
}
