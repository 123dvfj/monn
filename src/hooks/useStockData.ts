import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchQuotes, fetchChart, fetchNews, searchStocks,
  cachedFetch, type YQuote, type YCandle, type YNewsItem,
} from '../services/yahooFinance';

// ---- Key stock pools ----
export const INDEX_SYMBOLS = ['HSI', 'HSCEI', 'HSTECH', 'DJI', 'IXIC', 'SPX'];

export const ALL_HK_STOCKS = [
  // ═══════ Hang Seng Index Large Caps (最活跃蓝筹) ═══════
  // Conglomerates & Investment
  '00001', '00019', '00027', '00267', '00656', '00883',
  // Utilities & Infrastructure
  '00002', '00003', '00006', '00066', '00270', '01038', '02638',
  // Property Development
  '00004', '00012', '00016', '00017', '00823', '00960', '01109', '00688', '00683', '01972',
  // Property — REITs
  '00778', '00808', '00435', '01881', '01426',
  // Banking
  '00005', '00011', '00023', '02388', '02888',
  // Chinese Banks
  '00939', '01288', '01398', '03988', '01658', '03328', '01988', '02016', '03618',
  // Insurance
  '01299', '02318', '02628', '02601', '01339', '01336', '00966', '02328', '06099',
  // Securities & Finance
  '00388', '06030', '01776', '06066', '03958', '06886', '06881', '06837',
  // Brokerages
  '00165', '02611', '06806', '01476',
  // Tech — Internet Giants
  '00700', '09988', '01810', '03690', '09999', '09618', '01024', '09888', '09626',
  // Tech — Hardware & Semiconductor
  '00981', '01347', '00669', '02382', '00285', '00522', '02018', '01478', '01415', '03396',
  // Tech — SaaS & Cloud
  '03888', '00772', '00780', '08083', '02013', '03738',
  // Tech — E-commerce & Logistics
  '06618', '02618', '09961', '09899', '02518', '09699', '02157',
  // Tech — AI & Auto Tech
  '09660', '09880', '06698', '09698',
  // Consumer — Food & Beverage
  '00291', '00322', '01044', '00151', '00168', '00220', '00147', '00178',
  // Consumer — Dairy
  '02319', '06186', '01717',
  // Consumer — Retail & Brands
  '01929', '02020', '02331', '09992', '09633', '09896', '01876', '06110', '09688',
  // Consumer — Auto
  '01211', '00175', '02238', '02333', '01268', '09863', '09868', '02015', '00489', '00425',
  // Consumer — Home & Apparel
  '02313', '01999', '00357',
  // Consumer — Services & Education
  '01928', '06862', '09987', '09922', '00992', '09901', '01797',
  // Healthcare — Pharma
  '01093', '01177', '01099', '02196', '00241', '01530', '00867', '01066',
  // Healthcare — Biotech
  '02269', '01801', '06160', '02359', '09926', '06855', '09995', '02162',
  // Healthcare — Devices & Services
  '06098', '01515', '01833', '06609', '02138',
  // Energy — Oil & Gas
  '00857', '00386', '01088', '01171', '03993', '01898',
  // Energy — New Energy
  '00968', '00868', '01799', '03800', '01772', '02380', '00916', '01798',
  // Materials & Mining
  '00914', '01209', '02899', '01378', '00658', '03323',
  // Aviation & Shipping
  '00293', '00670', '00753', '01308', '01919', '01199',
  // Telecom
  '00941', '00728', '00762', '00788',
  // Diversified
  '00590', '01821', '09979', '01357', '06969', '06990', '02007',
  // HK-listed ETFs (高流动性)
  '02800', '02828', '02822', '03033', '03067', '03188', '02823', '03032',
  '03110', '02846', '03086', '03081', '03074', '02838',
];

export const ALL_US_STOCKS = [
  // ═══════ Mega Cap Tech (Magnificent 7 +) ═══════
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  // Semiconductors
  'AMD', 'INTC', 'QCOM', 'AVGO', 'TXN', 'MU', 'AMAT', 'LRCX', 'ASML',
  'ADI', 'KLAC', 'MRVL', 'ON', 'MPWR', 'NXPI', 'STM', 'ARM', 'SMCI',
  // Software & Cloud
  'ADBE', 'CRM', 'ORCL', 'NOW', 'SNOW', 'DDOG', 'CRWD', 'ZS', 'NET', 'MDB',
  'WDAY', 'TEAM', 'PLTR', 'PANW', 'FTNT', 'SPLK', 'DT', 'HUBS', 'DASH',
  // AI & Data Infrastructure
  'AI', 'PATH', 'CFLT', 'ESTC', 'SNPS', 'CDNS', 'ANET', 'DELL', 'HPQ',
  // Fintech & Payments
  'V', 'MA', 'PYPL', 'SQ', 'COIN', 'AFRM', 'SOFI', 'TOST', 'BILL', 'ADYEN',
  // E-commerce & Social Media
  'BABA', 'JD', 'PDD', 'SHOP', 'SNAP', 'PINS', 'U', 'MELI', 'CPNG', 'SE',
  // Chinese ADRs
  'BILI', 'TME', 'VIPS', 'TAL', 'EDU', 'YUMC', 'ZTO', 'BEKE', 'ATHM', 'DQ',
  'BZ', 'LI', 'XPEV', 'NIO', 'ZK', 'QFIN', 'RLX', 'MNSO',
  // EV & Auto
  'RIVN', 'LCID', 'F', 'GM', 'STLA', 'TM', 'HMC', 'RACE',
  // Banking & Finance
  'JPM', 'GS', 'BAC', 'C', 'WFC', 'MS', 'BLK', 'SCHW', 'AXP', 'USB',
  'PNC', 'TFC', 'COF', 'BK', 'AMP',
  // Healthcare — Pharma
  'JNJ', 'PFE', 'MRK', 'BMY', 'GSK', 'TAK', 'SNY', 'NVO',
  // Healthcare — Biotech
  'ABBV', 'LLY', 'AMGN', 'GILD', 'REGN', 'VRTX', 'BIIB', 'MRNA', 'BNTX',
  // Healthcare — Devices & Insurance
  'UNH', 'ISRG', 'DXCM', 'CI', 'HUM', 'ELV', 'TMO', 'ABT', 'BSX', 'SYK',
  // Consumer — Retail
  'COST', 'WMT', 'TGT', 'HD', 'LOW',
  // Consumer — Food & Beverage
  'KO', 'PEP', 'MCD', 'SBUX', 'YUM', 'CMG', 'MNST',
  // Consumer — Apparel & Lifestyle
  'NKE', 'LULU', 'DECK', 'TJX', 'DG', 'DLTR',
  // Consumer — Travel & Entertainment
  'DIS', 'ABNB', 'UBER', 'LYFT', 'BKNG', 'EXPE', 'RCL', 'CCL',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'OXY', 'EOG', 'PXD', 'DVN', 'HAL', 'BKR',
  // Telecom & Media
  'T', 'VZ', 'TMUS', 'NFLX', 'SPOT', 'WBD', 'PARA', 'CMCSA',
  // Aerospace & Defense
  'BA', 'LMT', 'RTX', 'NOC', 'GD', 'LHX',
  // Industrial & Manufacturing
  'CAT', 'DE', 'GE', 'HON', 'MMM', 'ETN', 'ITW', 'EMR', 'ROK', 'CARR',
  // Gaming & Metaverse
  'RBLX', 'HOOD', 'TTWO', 'EA', 'ATVI',
  // Cybersecurity
  'OKTA', 'S', 'CYBR', 'CHKP',
  // ═══════ ETFs ═══════
  // Broad Market
  'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO', 'IVV',
  // Leveraged & Inverse
  'TQQQ', 'SQQQ', 'UPRO', 'SPXU', 'TNA', 'SOXL', 'SOXS',
  // Sector ETFs
  'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLI', 'XLB', 'XLC', 'XLU', 'XLP', 'XLRE',
  // Thematic ETFs
  'SMH', 'SOXX', 'IBB', 'XBI', 'ARKK', 'ARKG', 'ARKW', 'ICLN', 'TAN',
  // International & China ETFs
  'EEM', 'FXI', 'KWEB', 'EFA', 'VWO', 'IEMG', 'MCHI', 'ASHR', 'CQQQ',
  // Bond & Commodity ETFs
  'TLT', 'AGG', 'GLD', 'VXX', 'IEF', 'LQD', 'HYG', 'USO', 'SLV',
];

// Default display sets (full lists - all available)
export const DEFAULT_HK_STOCKS = ALL_HK_STOCKS;
export const DEFAULT_US_STOCKS = ALL_US_STOCKS;

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
