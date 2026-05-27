import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, type IChartApi, type ISeriesApi, type CandlestickData, type HistogramData, type Time } from 'lightweight-charts';
import { useQuotes, useChart, ALL_HK_STOCKS, ALL_US_STOCKS } from '../hooks/useStockData';
import { useSearch } from '../hooks/useStockData';
import type { YQuote } from '../services/yahooFinance';

const ALL_STOCKS = [...ALL_HK_STOCKS, ...ALL_US_STOCKS];
// Initial load: popular stocks only to avoid rate limiting
const INITIAL_STOCKS = [
  ...ALL_HK_STOCKS.slice(0, 15),
  ...ALL_US_STOCKS.slice(0, 15),
];

const PERIODS: { label: string; range: string; interval: string }[] = [
  { label: '1D', range: '1d', interval: '5m' },
  { label: '5D', range: '5d', interval: '15m' },
  { label: '1M', range: '1mo', interval: '1h' },
  { label: '3M', range: '3mo', interval: '1d' },
  { label: '6M', range: '6mo', interval: '1d' },
  { label: '1Y', range: '1y', interval: '1d' },
  { label: '2Y', range: '2y', interval: '1wk' },
];

export default function Market() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState('00700');
  const [activePeriod, setActivePeriod] = useState(4);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'HK' | 'US'>('ALL');
  const [showAllStocks, setShowAllStocks] = useState(false);
  const [fetchAll, setFetchAll] = useState(false);

  // Only fetch full list when user expands, to avoid rate limiting
  const fetchSymbols = fetchAll ? ALL_STOCKS : INITIAL_STOCKS;
  const { quotes } = useQuotes(fetchSymbols, 60_000);
  const searchSymbols = searchQuery
    ? ALL_STOCKS.filter((s) => s.includes(searchQuery.toUpperCase())).slice(0, 20)
    : [];
  const { quotes: searchQuotes } = useQuotes(searchSymbols, 60_000);
  const { candles } = useChart(selectedSymbol, PERIODS[activePeriod].range, PERIODS[activePeriod].interval);
  const { search, results: searchResults, loading: searchLoading } = useSearch();

  const selectedQuote = quotes.find((q) => q.symbol === selectedSymbol);

  // Filter stocks by market
  const filteredQuotes = quotes.filter((q) => {
    const sym = q.symbol ?? '';
    const isHK = /^\d{5}$/.test(sym);
    if (marketFilter === 'HK') return isHK;
    if (marketFilter === 'US') return !isHK;
    return true;
  });

  const stockList = searchQuery ? searchQuotes : filteredQuotes;
  const visibleStocks = showAllStocks ? stockList : stockList.slice(0, 20);
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 480,
      layout: {
        background: { type: ColorType.Solid, color: '#141a23' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#1b2330' },
        horzLines: { color: '#1b2330' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#58a6ff', style: 2, width: 1, labelBackgroundColor: '#58a6ff' },
        horzLine: { color: '#58a6ff', style: 2, width: 1, labelBackgroundColor: '#58a6ff' },
      },
      rightPriceScale: { borderColor: 'rgba(255 255 255 / 0.08)' },
      timeScale: { borderColor: 'rgba(255 255 255 / 0.08)', timeVisible: true },
    });

    const cs = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderDownColor: '#ef5350', borderUpColor: '#26a69a',
      wickDownColor: '#ef5350', wickUpColor: '#26a69a',
    });

    const vs = chart.addHistogramSeries({
      color: '#26a69a33',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    vs.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chartInstance.current = chart;
    candleSeries.current = cs;
    volumeSeries.current = vs;

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data when candles change
  useEffect(() => {
    if (!candleSeries.current || !volumeSeries.current || candles.length === 0) return;
    const candleData: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const volData: HistogramData[] = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? '#26a69a44' : '#ef535044',
    }));
    candleSeries.current.setData(candleData);
    volumeSeries.current.setData(volData);
    chartInstance.current?.timeScale().fitContent();
  }, [candles]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.trim()) {
      search(q);
      setShowSearch(true);
    } else {
      setShowSearch(false);
    }
  }, [search]);

  const q = selectedQuote;
  const price = q?.regularMarketPrice ?? 0;
  const change = q?.regularMarketChange ?? 0;
  const changePct = q?.regularMarketChangePercent ?? 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">实时行情</h1>
        <p className="page-desc"><span className="live-dot" />个股K线 · 盘口数据 · Yahoo Finance 实时数据</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        {/* Visual Stock Picker */}
        <div className="card mb-4" style={{ padding: '12px' }}>
          {/* Search + Tabs row */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className="input"
                placeholder="搜索过滤..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) handleSearch(e.target.value); }}
                style={{ width: '100%', maxWidth: 280 }}
              />
              {showSearch && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, width: 300,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-sm)', zIndex: 100, maxHeight: 200, overflow: 'auto',
                }}>
                  {searchResults.map((r) => (
                    <div key={r.symbol} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px' }}
                      className="sidebar-item"
                      onClick={() => { setSelectedSymbol(r.symbol); setSearchQuery(''); setShowSearch(false); }}>
                      <span style={{ color: 'var(--color-accent)' }}>{r.symbol}</span> {r.shortName}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="tabs">
              {(['ALL', 'HK', 'US'] as const).map((f) => (
                <button key={f} className={`tab ${marketFilter === f ? 'active' : ''}`} onClick={() => setMarketFilter(f)}>
                  {{ ALL: `全部 (${ALL_STOCKS.length})`, HK: '港股', US: '美股' }[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Stock Card Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: '8px',
            maxHeight: showAllStocks ? 'none' : 280,
            overflowY: 'auto',
            padding: '2px',
          }}>
            {visibleStocks.map((item: any) => {
              const sym = item.symbol ?? '';
              const name = (item.shortName ?? item.name ?? sym).slice(0, 14);
              const price = item.regularMarketPrice ?? item.price ?? 0;
              const chgPct = item.regularMarketChangePercent ?? item.changePercent ?? 0;
              const isHK = /^\d{5}$/.test(sym);
              const isSelected = selectedSymbol === sym;

              return (
                <div
                  key={sym}
                  onClick={() => setSelectedSymbol(sym)}
                  style={{
                    background: isSelected ? 'var(--bg-active)' : 'var(--bg-tertiary)',
                    border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-accent)' }}>{sym}</span>
                    <span className="badge" style={{
                      background: isHK ? '#a371f722' : '#58a6ff22',
                      color: isHK ? 'var(--color-purple)' : 'var(--color-accent)',
                      fontSize: '10px',
                    }}>
                      {isHK ? 'HK' : 'US'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="font-mono" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {price ? price.toFixed(2) : '---'}
                    </span>
                    <span className={`font-mono ${chgPct >= 0 ? 'color-up' : 'color-down'}`} style={{ fontSize: '12px', fontWeight: 600 }}>
                      {chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {!fetchAll ? (
            <button className="btn btn-sm mt-3" style={{ width: '100%' }}
              onClick={() => { setFetchAll(true); setShowAllStocks(true); }}>
              加载全部 {ALL_STOCKS.length} 只股票 ▼
            </button>
          ) : stockList.length > 20 && (
            <button className="btn btn-sm mt-3" onClick={() => setShowAllStocks(!showAllStocks)} style={{ width: '100%' }}>
              {showAllStocks ? '收起 ▲' : `展开全部 (${stockList.length} 只) ▼`}
            </button>
          )}
        </div>

        {/* Quote Summary */}
        <div className="card mb-4">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '40px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {selectedSymbol} {q?.shortName ?? q?.longName ?? ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: 4 }}>
                <span className="stat-value" style={{ fontSize: '36px' }}>
                  {price ? price.toFixed(2) : '---'}
                </span>
                <span className={`stat-change ${changePct >= 0 ? 'color-up' : 'color-down'}`} style={{ fontSize: '18px' }}>
                  {change ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}` : ''}
                  {changePct ? ` (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)` : ''}
                </span>
              </div>
              {q?.currency && (
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>货币: {q.currency}</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', flex: 1 }}>
              {[
                { label: '开盘', value: q?.regularMarketOpen?.toFixed(2) },
                { label: '昨收', value: q?.regularMarketPreviousClose?.toFixed(2) },
                { label: '最高', value: q?.regularMarketDayHigh?.toFixed(2) },
                { label: '最低', value: q?.regularMarketDayLow?.toFixed(2) },
                { label: '成交量', value: q?.regularMarketVolume ? `${(q.regularMarketVolume / 10000).toFixed(0)}万` : undefined },
                { label: '市值', value: q?.marketCap ? `${(q.marketCap / 1e8).toFixed(0)}亿` : undefined },
                { label: 'PE(TTM)', value: q?.trailingPE?.toFixed(1) },
                { label: '52周高低', value: q?.fiftyTwoWeekHigh ? `${q.fiftyTwoWeekHigh.toFixed(1)} / ${q.fiftyTwoWeekLow?.toFixed(1)}` : undefined },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{item.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, marginTop: 2 }}>{item.value ?? '---'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="card mb-4">
          <div className="flex justify-between items-center">
            <div className="tabs" style={{ display: 'inline-flex' }}>
              {PERIODS.map((p, i) => (
                <button
                  key={p.label}
                  className={`tab ${activePeriod === i ? 'active' : ''}`}
                  onClick={() => setActivePeriod(i)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {candles.length > 0 ? `${candles.length} 根K线` : '加载中...'}
            </span>
          </div>
        </div>

        {/* K-line Chart */}
        <div className="card mb-4">
          <div ref={chartRef} style={{ width: '100%', height: 480 }} />
        </div>

        {/* Bid/Ask */}
        {q && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card">
              <div className="card-header"><span className="card-title">卖盘</span></div>
              <table className="data-table">
                <thead><tr><th>价格</th><th>数量</th></tr></thead>
                <tbody>
                  {q.ask ? (
                    <tr>
                      <td style={{ color: 'var(--color-down)' }}>{q.ask.toFixed(2)}</td>
                      <td>{q.askSize ? (q.askSize / 100).toFixed(0) : '---'}</td>
                    </tr>
                  ) : (
                    <tr><td colSpan={2} style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>暂无盘口数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">买盘</span></div>
              <table className="data-table">
                <thead><tr><th>价格</th><th>数量</th></tr></thead>
                <tbody>
                  {q.bid ? (
                    <tr>
                      <td style={{ color: 'var(--color-up)' }}>{q.bid.toFixed(2)}</td>
                      <td>{q.bidSize ? (q.bidSize / 100).toFixed(0) : '---'}</td>
                    </tr>
                  ) : (
                    <tr><td colSpan={2} style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>暂无盘口数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
