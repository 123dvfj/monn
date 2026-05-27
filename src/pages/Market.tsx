import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, type IChartApi } from 'lightweight-charts';
import { hotStocks, generateCandles, getStockInfo } from '../utils/mockData';
import type { Stock } from '../stores/useStore';

export default function Market() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const [selectedStock, setSelectedStock] = useState<Stock>(hotStocks[0]);
  const [activePeriod, setActivePeriod] = useState('1D');

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 480,
      layout: {
        background: { type: ColorType.Solid, color: '#161b22' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#58a6ff', style: 2, width: 1, labelBackgroundColor: '#58a6ff' },
        horzLine: { color: '#58a6ff', style: 2, width: 1, labelBackgroundColor: '#58a6ff' },
      },
      rightPriceScale: {
        borderColor: '#30363d',
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a33',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const candles = generateCandles(180);
    candleSeries.setData(candles);
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? '#26a69a44' : '#ef535044',
      }))
    );

    chart.timeScale().fitContent();
    chartInstance.current = chart;

    const handleResize = () => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  const stock = selectedStock;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">实时行情</h1>
        <p className="page-desc">个股分时 · K线图 · 盘口数据</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        {/* Stock Selector */}
        <div className="card mb-4">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {hotStocks.map((s) => (
              <button
                key={s.symbol}
                className={`btn ${selectedStock.symbol === s.symbol ? 'btn-primary' : ''}`}
                onClick={() => setSelectedStock(s)}
              >
                {s.symbol} {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Quote Summary */}
        <div className="card mb-4">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '40px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{stock.symbol} {stock.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: 4 }}>
                <span className="stat-value" style={{ fontSize: '36px' }}>{stock.price.toFixed(2)}</span>
                <span className={`stat-change ${stock.changePercent >= 0 ? 'color-up' : 'color-down'}`} style={{ fontSize: '18px' }}>
                  {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', flex: 1 }}>
              {[
                { label: '开盘', value: stock.open.toFixed(2) },
                { label: '昨收', value: stock.prevClose.toFixed(2) },
                { label: '最高', value: stock.high.toFixed(2) },
                { label: '最低', value: stock.low.toFixed(2) },
                { label: '成交量', value: `${(stock.volume / 10000).toFixed(0)}万` },
                { label: '市值', value: stock.marketCap ? `${(stock.marketCap / 1e8).toFixed(0)}亿` : '-' },
                { label: 'PE(TTM)', value: stock.pe?.toFixed(1) ?? '-' },
                { label: '市场', value: stock.market === 'HK' ? '港股' : '美股' },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{item.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, marginTop: 2 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="card mb-4">
          <div className="tabs" style={{ display: 'inline-flex' }}>
            {['1D', '5D', '1M', '3M', '6M', '1Y'].map((p) => (
              <button key={p} className={`tab ${activePeriod === p ? 'active' : ''}`} onClick={() => setActivePeriod(p)}>
                {p}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm">前复权</button>
            <button className="btn btn-sm">对数坐标</button>
          </div>
        </div>

        {/* K-line Chart */}
        <div className="card mb-4">
          <div ref={chartRef} style={{ width: '100%', height: 480 }} />
        </div>

        {/* Bid/Ask */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="card">
            <div className="card-header"><span className="card-title">卖盘五档</span></div>
            <table className="data-table">
              <thead><tr><th>价格</th><th>数量</th></tr></thead>
              <tbody>
                {[5,4,3,2,1].map((i) => (
                  <tr key={`ask-${i}`}>
                    <td style={{ color: 'var(--color-down)' }}>{(stock.price + i * 0.02).toFixed(2)}</td>
                    <td>{(Math.random() * 50000 + 10000).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">买盘五档</span></div>
            <table className="data-table">
              <thead><tr><th>价格</th><th>数量</th></tr></thead>
              <tbody>
                {[1,2,3,4,5].map((i) => (
                  <tr key={`bid-${i}`}>
                    <td style={{ color: 'var(--color-up)' }}>{(stock.price - i * 0.02).toFixed(2)}</td>
                    <td>{(Math.random() * 50000 + 10000).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
