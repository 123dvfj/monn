import { useState, useEffect, useRef, useMemo } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import type { IChartApi, CandlestickData, LineData, Time } from 'lightweight-charts';
import { useQuotes, useChart } from '../hooks/useStockData';
import { useStore } from '../stores/useStore';
import StockSelector from '../components/StockSelector';
import { computeIndicators, INDICATOR_PERIODS } from '../utils/indicators';
import type { IndicatorSignal } from '../utils/indicators';

export default function Technical() {
  const storeSymbol = useStore((s) => s.selectedStockSymbol);
  const setSelectedStockSymbol = useStore((s) => s.setSelectedStockSymbol);
  const [symbol, setSymbol] = useState(storeSymbol);

  useEffect(() => {
    if (storeSymbol && storeSymbol !== symbol) setSymbol(storeSymbol);
  }, [storeSymbol]);

  const handleSelectStock = (sym: string) => {
    setSymbol(sym);
    setSelectedStockSymbol(sym);
  };

  const { quotes } = useQuotes([symbol], 60_000);
  const q = quotes.find((x) => x.symbol === symbol);
  const price = q?.regularMarketPrice ?? 0;
  const chgPct = q?.regularMarketChangePercent ?? 0;

  const [periodIdx, setPeriodIdx] = useState(2); // default 6M
  const period = INDICATOR_PERIODS[periodIdx];
  const { candles } = useChart(symbol, period.range, period.interval);

  const indicators = useMemo(() => {
    if (candles.length < 20) return null;
    return computeIndicators(candles);
  }, [candles]);

  // Mini chart
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 300,
      layout: { background: { type: ColorType.Solid, color: '#141a23' }, textColor: '#8b949e' },
      grid: { vertLines: { color: '#1b2330' }, horzLines: { color: '#1b2330' } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: 'rgba(255 255 255 / 0.08)' },
      timeScale: { borderColor: 'rgba(255 255 255 / 0.08)', timeVisible: true },
    });

    const cs = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderDownColor: '#ef5350', borderUpColor: '#26a69a',
      wickDownColor: '#ef5350', wickUpColor: '#26a69a',
    });

    const candleData: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    cs.setData(candleData);

    // Add MA lines
    if (indicators) {
      const closes = candles.map((c) => c.close);
      const addLine = (series: (number | null)[], color: string, offset: number) => {
        const data: LineData[] = [];
        for (let i = 0; i < series.length; i++) {
          if (series[i] != null) data.push({ time: candles[i + offset]?.time as Time, value: series[i]! });
        }
        if (data.length > 0) {
          const ls = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false });
          ls.setData(data);
        }
      };

      // We need to recompute MA from the full series
      const ma5 = smaArr(closes, 5);
      const ma10 = smaArr(closes, 10);
      const ma20 = smaArr(closes, 20);

      const offset5 = candles.length - ma5.filter((v) => v != null).length;
      const offset10 = candles.length - ma10.filter((v) => v != null).length;
      const offset20 = candles.length - ma20.filter((v) => v != null).length;

      addLine(ma5, '#f4d03f', offset5);
      addLine(ma10, '#e67e22', offset10);
      addLine(ma20, '#58a6ff', offset20);
    }

    chart.timeScale().fitContent();
    chartInstance.current = chart;

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [candles, indicators]);

  const signalColor = (s: IndicatorSignal) =>
    s.type === 'bullish' ? 'var(--color-up)' :
    s.type === 'bearish' ? 'var(--color-down)' : 'var(--text-secondary)';

  const signalBg = (s: IndicatorSignal) =>
    s.type === 'bullish' ? 'var(--color-up-bg)' :
    s.type === 'bearish' ? 'var(--color-down-bg)' : 'var(--bg-tertiary)';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">技术分析</h1>
        <p className="page-desc">
          {candles.length > 0
            ? <><span className="live-dot" />MA · MACD · RSI · BOLL · KDJ · {candles.length} 根K线</>
            : '加载K线数据中...'}
        </p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        {/* Stock + Period selectors */}
        <div className="card mb-4" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <StockSelector
              value={symbol}
              onChange={handleSelectStock}
              priceLabel={q ? (
                <>
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{q.shortName ?? ''}</span>
                  <span style={{ marginLeft: 12 }}>{price.toFixed(2)}</span>
                  <span className={chgPct >= 0 ? 'color-up' : 'color-down'} style={{ fontSize: '13px', marginLeft: 8 }}>
                    {chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%
                  </span>
                </>
              ) : undefined}
            />
            <div style={{ display: 'flex', gap: '4px', marginLeft: 16 }}>
              {INDICATOR_PERIODS.map((p, i) => (
                <button
                  key={p.label}
                  className={`btn btn-sm ${periodIdx === i ? 'btn-primary' : ''}`}
                  onClick={() => setPeriodIdx(i)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mini K-line chart */}
        <div className="card mb-4">
          <div className="card-title mb-3">K线图 · {period.label}</div>
          <div ref={chartRef} style={{ width: '100%', height: 300 }} />
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
            <span><span style={{ color: '#f4d03f' }}>──</span> MA5</span>
            <span><span style={{ color: '#e67e22' }}>──</span> MA10</span>
            <span><span style={{ color: '#58a6ff' }}>──</span> MA20</span>
          </div>
        </div>

        {!indicators ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
            {candles.length > 0 ? 'K线数据不足，需要至少20根K线计算指标' : '加载中...'}
          </div>
        ) : (
          <>
            {/* Indicator values */}
            <div className="dashboard-grid fixed-3col mb-4">
              {/* MA */}
              <div className="card">
                <div className="card-title mb-3">移动均线 MA</div>
                {[
                  { label: 'MA5', value: indicators.ma5, color: '#f4d03f' },
                  { label: 'MA10', value: indicators.ma10, color: '#e67e22' },
                  { label: 'MA20', value: indicators.ma20, color: '#58a6ff' },
                  { label: 'MA60', value: indicators.ma60, color: '#a371f7' },
                ].map((m) => (
                  <div key={m.label} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 12, color: m.color, fontWeight: 600 }}>{m.label}</span>
                    <span className="font-mono" style={{ fontSize: 13 }}>
                      {m.value != null ? m.value.toFixed(2) : '---'}
                    </span>
                  </div>
                ))}
                <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {price > 0 && indicators.ma20 ? `现价 ${price.toFixed(2)} vs MA20: ${((price / indicators.ma20 - 1) * 100).toFixed(1)}%` : ''}
                </div>
              </div>

              {/* MACD */}
              <div className="card">
                <div className="card-title mb-3">MACD (12,26,9)</div>
                {indicators.macd ? (
                  <div>
                    {[
                      { label: 'DIF', value: indicators.macd.dif },
                      { label: 'DEA', value: indicators.macd.dea },
                      { label: '柱值', value: indicators.macd.histogram },
                    ].map((m) => (
                      <div key={m.label} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.label}</span>
                        <span className={`font-mono ${m.value >= 0 ? 'color-up' : 'color-down'}`} style={{ fontSize: 13, fontWeight: 600 }}>
                          {m.value.toFixed(4)}
                        </span>
                      </div>
                    ))}
                    <div className="mt-2 text-xs" style={{ color: indicators.macd.histogram >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                      {indicators.macd.histogram >= 0 ? '▲ 多头动能' : '▼ 空头动能'}
                    </div>
                  </div>
                ) : <div style={{ color: 'var(--text-tertiary)' }}>数据不足</div>}
              </div>

              {/* RSI */}
              <div className="card">
                <div className="card-title mb-3">RSI (14)</div>
                {indicators.rsi14 != null ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: 36, fontWeight: 700,
                      color: indicators.rsi14 > 70 ? 'var(--color-down)' :
                             indicators.rsi14 < 30 ? 'var(--color-up)' : 'var(--text-primary)',
                    }}>
                      {indicators.rsi14}
                    </div>
                    <div style={{ height: 8, background: 'linear-gradient(90deg, var(--color-up), var(--color-warning), var(--color-down))', borderRadius: 4, position: 'relative', marginTop: 8 }}>
                      <div style={{ position: 'absolute', left: `${Math.min(100, Math.max(0, indicators.rsi14))}%`, top: -4, width: 16, height: 16, background: '#fff', borderRadius: '50%', border: '2px solid var(--color-accent)', transform: 'translateX(-50%)' }} />
                    </div>
                    <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      <span>0 超卖</span><span>50</span><span>100 超买</span>
                    </div>
                    <div className="mt-2 text-xs" style={{
                      color: indicators.rsi14 > 70 ? 'var(--color-down)' :
                             indicators.rsi14 < 30 ? 'var(--color-up)' : 'var(--text-secondary)',
                    }}>
                      {indicators.rsi14 > 80 ? '极度超买' :
                       indicators.rsi14 > 70 ? '超买区域' :
                       indicators.rsi14 < 20 ? '极度超卖' :
                       indicators.rsi14 < 30 ? '超卖区域' : '正常区间'}
                    </div>
                  </div>
                ) : <div style={{ color: 'var(--text-tertiary)' }}>数据不足</div>}
              </div>
            </div>

            <div className="dashboard-grid fixed-3col mb-4">
              {/* BOLL */}
              <div className="card">
                <div className="card-title mb-3">布林带 BOLL (20,2)</div>
                {indicators.boll ? (
                  <div>
                    {[
                      { label: '上轨', value: indicators.boll.upper, color: 'var(--color-down)' },
                      { label: '中轨', value: indicators.boll.middle, color: 'var(--color-warning)' },
                      { label: '下轨', value: indicators.boll.lower, color: 'var(--color-up)' },
                    ].map((m) => (
                      <div key={m.label} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 12, color: m.color }}>{m.label}</span>
                        <span className="font-mono" style={{ fontSize: 13 }}>{m.value.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      带宽: {indicators.boll.width}% | {indicators.boll.width < 5 ? '收窄→变盘信号' : '正常'}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {price > 0 ? `现价位置: ${((price - indicators.boll.lower) / (indicators.boll.upper - indicators.boll.lower) * 100).toFixed(0)}%` : ''}
                    </div>
                  </div>
                ) : <div style={{ color: 'var(--text-tertiary)' }}>数据不足</div>}
              </div>

              {/* KDJ */}
              <div className="card">
                <div className="card-title mb-3">KDJ (9,3,3)</div>
                {indicators.kdj ? (
                  <div>
                    {[
                      { label: 'K', value: indicators.kdj.k },
                      { label: 'D', value: indicators.kdj.d },
                      { label: 'J', value: indicators.kdj.j },
                    ].map((m) => (
                      <div key={m.label} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.label}</span>
                        <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: m.value > 80 ? 'var(--color-down)' : m.value < 20 ? 'var(--color-up)' : 'var(--text-primary)' }}>
                          {m.value.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="mt-2 text-xs" style={{ color: indicators.kdj.j > 100 ? 'var(--color-down)' : indicators.kdj.j < 0 ? 'var(--color-up)' : 'var(--text-tertiary)' }}>
                      {indicators.kdj.j > 100 ? 'J值超买' : indicators.kdj.j < 0 ? 'J值超卖' : indicators.kdj.k > indicators.kdj.d ? 'K > D 偏多' : 'K < D 偏空'}
                    </div>
                  </div>
                ) : <div style={{ color: 'var(--text-tertiary)' }}>数据不足</div>}
              </div>

              {/* ATR */}
              <div className="card">
                <div className="card-title mb-3">ATR (14) 真实波幅</div>
                {indicators.atr14 != null ? (
                  <div style={{ textAlign: 'center' }}>
                    <div className="stat-value" style={{ fontSize: 28, marginTop: 12 }}>
                      {indicators.atr14.toFixed(2)}
                    </div>
                    <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                      占现价 {price > 0 ? ((indicators.atr14 / price) * 100).toFixed(2) : '---'}%
                    </div>
                    <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      日波动区间估算: {price > 0 ? `${(price - indicators.atr14).toFixed(2)} - ${(price + indicators.atr14).toFixed(2)}` : '---'}
                    </div>
                  </div>
                ) : <div style={{ color: 'var(--text-tertiary)' }}>数据不足</div>}
              </div>
            </div>

            {/* Signals */}
            <div className="card">
              <div className="card-title mb-3">综合信号 ({indicators.signals.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {indicators.signals.map((s, i) => (
                  <div key={i} style={{
                    padding: '6px 12px',
                    background: signalBg(s),
                    border: `1px solid ${s.type === 'bullish' ? 'rgba(38 166 154 / 0.2)' : s.type === 'bearish' ? 'rgba(239 83 80 / 0.2)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                  }}>
                    <span className="badge" style={{
                      background: s.type === 'bullish' ? 'var(--color-up-bg)' : s.type === 'bearish' ? 'var(--color-down-bg)' : 'var(--bg-tertiary)',
                      color: signalColor(s),
                      marginRight: 6, fontSize: 10,
                    }}>
                      {s.indicator}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{s.message}</span>
                    <span style={{
                      marginLeft: 6, fontSize: 10,
                      color: s.strength === 'strong' ? 'var(--color-warning)' : 'var(--text-tertiary)',
                    }}>
                      {s.strength === 'strong' ? '★★★' : s.strength === 'moderate' ? '★★' : '★'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Inline SMA for chart overlay (duplicated to avoid import complexity)
function smaArr(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result.push(+(sum / period).toFixed(4));
  }
  return result;
}
