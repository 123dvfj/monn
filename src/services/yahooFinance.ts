// Use proxy in dev (Vite handles /api/yahoo/* -> Yahoo Finance)
const isDev = typeof window !== 'undefined' && window.location.port === '5173';
const BASE = isDev ? '' : 'https://query1.finance.yahoo.com';
const BASE_NEWS = isDev ? '' : 'https://query2.finance.yahoo.com';

const QUOTE_URL = isDev ? '/api/yahoo/v7/finance/quote' : `${BASE}/v7/finance/quote`;
const CHART_URL = isDev ? '/api/yahoo/v8/finance/chart' : `${BASE}/v8/finance/chart`;
const SEARCH_URL = isDev ? '/api/yahoo/v1/finance/search' : `${BASE}/v1/finance/search`;
const NEWS_URL = isDev ? '/api/yahoo-news/v1/finance/news' : `${BASE_NEWS}/v1/finance/news`;

// ---- Symbol conversion ----
const HK_MAP: Record<string, string> = {
  '00700': '0700.HK', '09988': '9988.HK', '01810': '1810.HK',
  '00388': '0388.HK', '09618': '9618.HK', '01211': '1211.HK',
  '02269': '2269.HK', '00016': '0016.HK', '00005': '0005.HK',
  '02318': '2318.HK', '00941': '0941.HK', '03690': '3690.HK',
  '09999': '9999.HK', '09626': '9626.HK', '09888': '9888.HK',
  '02015': '2015.HK', '01024': '1024.HK', '09901': '9901.HK',
};

const INDEX_MAP: Record<string, string> = {
  'HSI': '^HSI', 'HSCEI': '^HSCE', 'HSTECH': '^HSTECH',
  'DJI': '^DJI', 'IXIC': '^IXIC', 'SPX': '^GSPC',
};

export function toYahooSymbol(sym: string): string {
  if (INDEX_MAP[sym]) return INDEX_MAP[sym];
  if (HK_MAP[sym]) return HK_MAP[sym];
  // Auto-detect HK stock: 5-digit code → 4-digit padded HK format
  if (/^\d{5}$/.test(sym)) {
    const num = parseInt(sym, 10);
    return `${String(num).padStart(4, '0')}.HK`;
  }
  return sym;
}

function fromYahooSymbol(ys: string): string {
  for (const [k, v] of Object.entries(INDEX_MAP)) { if (v === ys) return k; }
  for (const [k, v] of Object.entries(HK_MAP)) { if (v === ys) return k; }
  // Handle 4-digit.HK format → pad to 5-digit
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
  market?: string;
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
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Yahoo API error: ${res.status}`);
  return res.json();
}

export async function fetchQuotes(symbols: string[]): Promise<YQuote[]> {
  const ySymbols = symbols.map(toYahooSymbol);
  const data = await yahooFetch<any>(
    `${QUOTE_URL}?symbols=${ySymbols.join(',')}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,regularMarketPreviousClose,marketCap,trailingPE,forwardPE,bid,ask,bidSize,askSize,shortName,longName,fiftyTwoWeekHigh,fiftyTwoWeekLow,averageDailyVolume3Month,market,currency,exchangeName`
  );
  const result = data?.quoteResponse?.result ?? [];
  return result.map((r: any) => ({
    ...r,
    symbol: fromYahooSymbol(r.symbol ?? ''),
  }));
}

export async function fetchChart(
  symbol: string,
  range: string = '6mo',
  interval: string = '1d'
): Promise<YCandle[]> {
  const ys = toYahooSymbol(symbol);
  const data = await yahooFetch<any>(
    `${CHART_URL}/${encodeURIComponent(ys)}?range=${range}&interval=${interval}`
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
  const data = await yahooFetch<any>(`${SEARCH_URL}?q=${encodeURIComponent(query)}&quotesCount=10`);
  const quotes = data?.quotes ?? [];
  return quotes
    .filter((q: any) => q.quoteType === 'EQUITY' && (q.exchange === 'HKG' || q.exchange === 'NMS' || q.exchange === 'NYQ' || q.exchange === 'NCM' || q.exchange === 'NGM'))
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
}

export async function fetchNews(symbols: string[] = [], count: number = 20): Promise<YNewsItem[]> {
  const ys = symbols.map(toYahooSymbol);
  const url = ys.length > 0
    ? `${NEWS_URL}?symbols=${ys.join(',')}&count=${count}`
    : `${NEWS_URL}?count=${count}`;
  try {
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

// ---- Cache helper ----
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = {
  quote: 15_000,   // 15s for quotes
  chart: 300_000,  // 5min for chart
  news: 120_000,   // 2min for news
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
