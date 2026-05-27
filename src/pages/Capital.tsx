import { useState, useMemo, useEffect } from 'react';
import { useQuotes, ALL_HK_STOCKS, ALL_US_STOCKS } from '../hooks/useStockData';
import type { YQuote } from '../services/yahooFinance';
import { useStore } from '../stores/useStore';

const ALL_STOCKS = [...ALL_HK_STOCKS, ...ALL_US_STOCKS];

function generateFlowSummary(q: YQuote | undefined, symbol: string): string[] {
  if (!q || !q.regularMarketPrice) return ['请先选择一只股票以生成资金面分析。'];
  const isHK = /^\d{5}$/.test(symbol);
  const price = q.regularMarketPrice;
  const chgPct = q.regularMarketChangePercent ?? 0;
  const vol = q.regularMarketVolume ?? 0;
  const avgVol = q.averageDailyVolume3Month ?? 0;
  const hasAvgVol = avgVol > 0;
  const volRatio = hasAvgVol ? vol / avgVol : NaN;

  const points: string[] = [];

  // Volume analysis
  if (hasAvgVol) {
    if (volRatio > 2) {
      points.push(`今日成交量是日均的 ${volRatio.toFixed(1)} 倍，出现极度放量，价格${chgPct >= 0 ? '上涨' : '下跌'} ${Math.abs(chgPct).toFixed(2)}%，资金参与度极高。`);
    } else if (volRatio > 1.3) {
      points.push(`今日成交量是日均的 ${volRatio.toFixed(1)} 倍，温和放量，${chgPct >= 0 ? '买盘积极性提升' : '抛压有所增加'}。`);
    } else if (volRatio > 0.7) {
      points.push(`今日成交量与日均持平（${volRatio.toFixed(1)}x），市场情绪平稳，资金以存量博弈为主。`);
    } else {
      points.push(`今日成交量仅为日均的 ${(volRatio * 100).toFixed(0)}%，交投清淡，市场关注度较低。`);
    }
  } else {
    points.push(`今日成交量 ${(vol / 10000).toFixed(0)} 万，暂无日均成交量数据可供对比。`);
  }

  // Price momentum
  if (chgPct > 3) {
    points.push(`涨幅 ${chgPct.toFixed(2)}%，强势拉升信号，需关注后续量能能否持续。若缩量上涨则需警惕冲高回落。`);
  } else if (chgPct < -3) {
    points.push(`跌幅 ${Math.abs(chgPct).toFixed(2)}%，资金流出明显${hasAvgVol && volRatio > 1.5 ? '，放量下跌需警惕进一步下行风险' : ''}。`);
  } else if (Math.abs(chgPct) < 0.5) {
    points.push(`价格波动极小（${chgPct.toFixed(2)}%），多空力量均衡，资金呈观望态度。`);
  }

  // Bid/Ask
  if (q.bid != null && q.ask != null) {
    const spread = q.ask - q.bid;
    const spreadPct = (spread / price) * 100;
    points.push(`当前买盘 ${q.bid.toFixed(2)} / 卖盘 ${q.ask.toFixed(2)}，价差 ${spread.toFixed(2)}（${spreadPct.toFixed(2)}%），流动性${spreadPct < 0.1 ? '良好' : '一般'}。`);
  }

  // Market cap context
  const cap = q.marketCap ?? 0;
  const capDesc = cap > 1e12 ? '超大盘' : cap > 1e11 ? '大盘' : cap > 1e10 ? '中盘' : '小盘';
  points.push(`${capDesc}标的，${isHK ? '港股' : '美股'}市场，${isHK ? '南向资金活跃度影响整体估值水平' : '机构资金主导定价权'}。`);

  points.push('⚠️ 港美股无类似A股的"主力资金/北向资金"数据，以上基于量价关系推断，仅供参考。');

  return points;
}

export default function Capital() {
  const storeSymbol = useStore((s) => s.selectedStockSymbol);
  const [symbol, setSymbol] = useState(storeSymbol);

  useEffect(() => {
    if (storeSymbol && storeSymbol !== symbol) {
      setSymbol(storeSymbol);
    }
  }, [storeSymbol]);

  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const stockList = useMemo(() => {
    if (!searchText.trim()) return ALL_STOCKS;
    const kw = searchText.toUpperCase();
    return ALL_STOCKS.filter((s) => s.includes(kw)).slice(0, 30);
  }, [searchText]);

  const { quotes } = useQuotes([symbol], 60_000);
  const q = quotes.find((x) => x.symbol === symbol);
  const isHK = /^\d{5}$/.test(symbol);

  const price = q?.regularMarketPrice ?? 0;
  const chgPct = q?.regularMarketChangePercent ?? 0;
  const vol = q?.regularMarketVolume ?? 0;
  const avgVol = q?.averageDailyVolume3Month ?? 0;
  const hasAvgVol = avgVol > 0;
  const volRatio = hasAvgVol ? vol / avgVol : NaN;
  const dayHigh = q?.regularMarketDayHigh ?? price;
  const dayLow = q?.regularMarketDayLow ?? price;
  const dayRange = dayHigh - dayLow;
  const posInDay = dayRange > 0 ? ((price - dayLow) / dayRange) * 100 : 50;

  const aiPoints = useMemo(() => generateFlowSummary(q, symbol), [q, symbol]);

  const selectStock = (sym: string) => {
    setSymbol(sym);
    setSearchText('');
    setShowDropdown(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">资金筹码</h1>
        <p className="page-desc"><span className="live-dot" />量价关系 · 盘口数据 · 成交量分析 · AI 资金面研判</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        {/* Stock Selector */}
        <div className="card mb-4" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>选择股票：</span>
            <input
              className="input"
              placeholder="输入代码搜索..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              style={{ width: 260, fontSize: '13px' }}
            />
            {q && (
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                {symbol} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{q.shortName ?? ''}</span>
                <span style={{ marginLeft: 12 }}>{price.toFixed(2)}</span>
                <span className={chgPct >= 0 ? 'color-up' : 'color-down'} style={{ fontSize: '13px', marginLeft: 8 }}>
                  {chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%
                </span>
              </span>
            )}
            {showDropdown && searchText && (
              <div style={{
                position: 'absolute', top: '100%', left: 80, width: 260,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)', zIndex: 100, maxHeight: 250, overflow: 'auto',
              }}>
                {stockList.map((s) => (
                  <div key={s} onClick={() => selectStock(s)}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', fontFamily: 'monospace' }}
                    className="sidebar-item">{s}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Flow Summary */}
        <div className="card mb-4" style={{ borderLeft: '3px solid var(--color-warning)' }}>
          <div className="card-title mb-3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>AI 资金面分析</span>
            <span className="badge" style={{ background: '#d2992222', color: 'var(--color-warning)', fontSize: '10px' }}>量价推断</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {aiPoints.map((point, i) => (
              <div key={i} style={{ fontSize: '13px', color: i === aiPoints.length - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)', lineHeight: 1.7 }}>
                {point}
              </div>
            ))}
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="dashboard-grid fixed-3col mb-4">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>成交量 vs 日均</div>
            <div className="stat-value" style={{ fontSize: '28px', marginTop: 8, color: hasAvgVol ? (volRatio > 1.5 ? 'var(--color-up)' : volRatio < 0.5 ? 'var(--color-down)' : 'var(--text-primary)') : 'var(--text-tertiary)' }}>
              {hasAvgVol ? `${volRatio.toFixed(1)}x` : '---'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 4 }}>
              当日 {(vol / 10000).toFixed(0)}万{hasAvgVol ? ` / 日均 ${(avgVol / 10000).toFixed(0)}万` : '（无日均数据）'}
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>日内价格位置</div>
            <div style={{ marginTop: 8, height: 8, background: 'linear-gradient(90deg, var(--color-down), var(--color-warning), var(--color-up))', borderRadius: 4, position: 'relative' }}>
              <div style={{ position: 'absolute', left: `${posInDay}%`, top: -4, width: 16, height: 16, background: '#fff', borderRadius: '50%', border: '2px solid var(--color-accent)', transform: 'translateX(-50%)' }} />
            </div>
            <div className="flex justify-between mt-2" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              <span>低 {dayLow.toFixed(2)}</span>
              <span>高 {dayHigh.toFixed(2)}</span>
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>量价配合信号</div>
            <div className="stat-value" style={{ fontSize: '24px', marginTop: 8, color: chgPct > 0 && volRatio > 1.2 ? 'var(--color-up)' : chgPct < 0 && volRatio > 1.2 ? 'var(--color-down)' : 'var(--text-secondary)' }}>
              {!hasAvgVol ? '数据不足 —' :
               chgPct > 0 && volRatio > 1.2 ? '放量上涨 ▲' :
               chgPct < 0 && volRatio > 1.2 ? '放量下跌 ▼' :
               chgPct > 0 && volRatio < 0.7 ? '缩量上涨 ↗' :
               chgPct < 0 && volRatio < 0.7 ? '缩量下跌 ↘' : '量价均衡 —'}
            </div>
          </div>
        </div>

        {/* Volume Analysis */}
        <div className="card mb-4">
          <div className="card-title mb-4">成交量分析</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: '当日成交量', value: vol > 0 ? `${(vol / 10000).toFixed(0)}万` : '---',
                bar: hasAvgVol ? Math.min(100, volRatio * 33) : 100, color: 'var(--color-accent)' },
              { label: '日均成交量(3M)', value: hasAvgVol ? `${(avgVol / 10000).toFixed(0)}万` : '暂无数据',
                bar: hasAvgVol ? 33 : 0, color: 'var(--text-tertiary)' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span style={{ width: 120, fontSize: '13px', color: 'var(--text-secondary)' }}>{item.label}</span>
                <div style={{ flex: 1, height: 24, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.bar}%`, background: item.color, opacity: 0.7, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
                <span style={{ width: 80, textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{item.value}</span>
              </div>
            ))}
          </div>
          {hasAvgVol && volRatio > 2 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--color-up-bg)', borderRadius: 4, fontSize: '12px', color: 'var(--color-up)' }}>
              成交量异常放大（{volRatio.toFixed(1)}x），可能受事件驱动，建议关注相关公告或新闻。
            </div>
          )}
          {hasAvgVol && volRatio < 0.3 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: '12px', color: 'var(--text-tertiary)' }}>
              成交量极度萎缩（{volRatio.toFixed(1)}x），市场参与度低，可能是盘整蓄力期。
            </div>
          )}
        </div>

        {/* Bid/Ask + Volume bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 16 }}>
          {/* Bid/Ask */}
          <div className="card">
            <div className="card-title mb-4">盘口数据</div>
            {q?.bid != null || q?.ask != null ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>买一价</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-up)' }}>{q.bid?.toFixed(2) ?? '---'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>量: {q.bidSize ? `${(q.bidSize / 100).toFixed(0)}手` : '---'}</div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>卖一价</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-down)' }}>{q.ask?.toFixed(2) ?? '---'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>量: {q.askSize ? `${(q.askSize / 100).toFixed(0)}手` : '---'}</div>
                  </div>
                </div>
                {q.bid != null && q.ask != null && (
                  <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    买卖价差: {(q.ask - q.bid).toFixed(2)} ({(((q.ask - q.bid) / price) * 100).toFixed(3)}%)
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)', fontSize: '13px' }}>
                {isHK ? '港股暂无实时盘口数据' : '暂无盘口数据（可能非交易时段）'}
              </div>
            )}
          </div>

          {/* Volume Anomaly Detection */}
          <div className="card">
            <div className="card-title mb-4">成交量异常评分</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', fontWeight: 700, color: hasAvgVol ? (volRatio > 2 ? 'var(--color-up)' : volRatio > 1.3 ? 'var(--color-warning)' : 'var(--text-secondary)') : 'var(--text-tertiary)' }}>
                {!hasAvgVol ? '—' : volRatio > 3 ? '🔥' : volRatio > 2 ? '▲' : volRatio > 1.3 ? '▶' : '—'}
              </div>
              <div style={{ fontSize: '14px', marginTop: 8 }}>
                {!hasAvgVol ? '无日均数据' : volRatio > 3 ? '极度活跃' : volRatio > 2 ? '显著放量' : volRatio > 1.3 ? '温和放量' : volRatio > 0.5 ? '正常交投' : '极度冷清'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 12 }}>
                量比: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{hasAvgVol ? volRatio.toFixed(2) + 'x' : '---'}</span>
                &nbsp;|&nbsp;
                换手估算: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {q?.marketCap ? `${((vol * price / q.marketCap) * 100).toFixed(3)}%` : '---'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dragon & Tiger List — Reference Only */}
        <div className="card">
          <div className="card-title mb-4">龙虎榜（参考）</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 12 }}>
            ⚠️ 龙虎榜为中国A股特有机制，港美股无此制度。以下为示例数据，仅供了解概念。
          </div>
          <table className="data-table">
            <thead>
              <tr><th>个股</th><th>上榜原因</th><th>买入前五</th><th>卖出前五</th><th>净买入</th></tr>
            </thead>
            <tbody>
              {[
                { symbol: '00700', reason: '日涨幅偏离值达7%', buy: '12.5亿', sell: '8.2亿', net: '+4.3亿' },
                { symbol: '01810', reason: '连续三个交易日涨幅20%', buy: '8.8亿', sell: '5.1亿', net: '+3.7亿' },
                { symbol: '09618', reason: '日跌幅偏离值达7%', buy: '3.2亿', sell: '6.5亿', net: '-3.3亿' },
              ].map((row) => (
                <tr key={row.symbol}>
                  <td style={{ color: 'var(--color-accent)' }}>{row.symbol}</td>
                  <td>{row.reason}</td>
                  <td>{row.buy}</td>
                  <td>{row.sell}</td>
                  <td className={row.net.startsWith('+') ? 'color-up' : 'color-down'}>{row.net}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
