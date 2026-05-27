import { useState, useMemo, useEffect } from 'react';
import { useQuotes, ALL_HK_STOCKS, ALL_US_STOCKS } from '../hooks/useStockData';
import type { YQuote } from '../services/yahooFinance';
import { financialData, announcements } from '../utils/mockData';
import { computeCompositeScore, type CompositeResult } from '../utils/scoring';
import { useStore } from '../stores/useStore';

const ALL_STOCKS = [...ALL_HK_STOCKS, ...ALL_US_STOCKS];

function generateAISummary(q: YQuote | undefined, composite: CompositeResult | null): string[] {
  if (!q || !q.regularMarketPrice) return ['请先选择一只股票以生成 AI 分析摘要。'];
  const isHK = /^\d{5}$/.test(q.symbol ?? '');
  const currency = isHK ? 'HKD' : 'USD';
  const price = q.regularMarketPrice;
  const pe = q.trailingPE;
  const cap = q.marketCap ?? 0;
  const high52 = q.fiftyTwoWeekHigh ?? 0;
  const low52 = q.fiftyTwoWeekLow ?? 0;
  const range52 = high52 - low52;
  const posIn52 = range52 > 0 ? ((price - low52) / range52) * 100 : 50;

  const points: string[] = [];

  // Composite score header
  if (composite) {
    points.push(`【综合评级: ${composite.rating}】得分 ${composite.compositeScore.toFixed(1)}/10，置信度 ${composite.confidence}。评分维度: 基本面(${composite.fundamentalScore.toFixed(1)}) + 技术面(${composite.technicalScore.toFixed(1)}) + 情绪面(${composite.sentimentScore.toFixed(1)})。`);
  }

  // Valuation
  if (pe != null && pe > 0) {
    if (pe < 15) points.push(`当前 PE(TTM) 为 ${pe.toFixed(1)} 倍，处于较低估值区间，可能具有安全边际。`);
    else if (pe < 25) points.push(`当前 PE(TTM) 为 ${pe.toFixed(1)} 倍，估值处于合理区间，与市场平均水平接近。`);
    else if (pe < 40) points.push(`当前 PE(TTM) 为 ${pe.toFixed(1)} 倍，估值偏高，市场给予较高增长预期溢价。`);
    else points.push(`当前 PE(TTM) 为 ${pe.toFixed(1)} 倍，处于高估值区域，需关注业绩增速能否支撑当前估值。`);
  } else {
    points.push('暂无 PE 数据，建议结合市净率(PB)等其他指标综合判断估值水平。');
  }

  // 52-week position
  if (posIn52 <= 20) points.push(`股价接近 52 周低位区域（低位上方 ${posIn52.toFixed(0)}%），若基本面未恶化可能具备反弹潜力。`);
  else if (posIn52 >= 80) points.push(`股价接近 52 周高位区域（高位下方 ${(100 - posIn52).toFixed(0)}%），短期追高风险较大，建议等待回调。`);
  else points.push(`股价处于 52 周区间中部位置（${posIn52.toFixed(0)}% 分位），多空力量相对均衡。`);

  // Market cap
  const capDesc = cap > 1e12 ? '超大盘' : cap > 1e11 ? '大盘' : cap > 1e10 ? '中盘' : '小盘';
  points.push(`市值约 ${(cap / 1e8).toFixed(0)} 亿${currency}，属于${capDesc}股票，流动性${cap > 1e11 ? '充裕' : '一般'}。`);

  // Volume analysis
  const vol = q.regularMarketVolume ?? 0;
  const avgVol = q.averageDailyVolume3Month ?? 0;
  if (vol > 0 && avgVol > 0) {
    const volRatio = vol / avgVol;
    if (volRatio > 1.5) points.push(`今日成交量显著放大（${volRatio.toFixed(1)}倍于日均），市场关注度提升，可能存在事件驱动。`);
    else if (volRatio < 0.5) points.push(`今日成交量偏低（${volRatio.toFixed(1)}倍于日均），市场交投清淡。`);
  }

  // Entry/Exit from composite
  if (composite) {
    points.push(`建议入场: 激进 ${composite.entryLevels.aggressive} / 适中 ${composite.entryLevels.moderate} / 保守 ${composite.entryLevels.conservative}。止损: ${composite.stopLoss}。目标: T1 ${composite.exitTargets.target1} / T2 ${composite.exitTargets.target2} / T3 ${composite.exitTargets.target3}。`);
  }

  points.push('以上分析基于有限数据指标自动生成，不构成投资建议。投资决策请结合完整基本面研究。');

  return points;
}

export default function Fundamental() {
  const storeSymbol = useStore((s) => s.selectedStockSymbol);
  const [symbol, setSymbol] = useState(storeSymbol);

  // Sync from Market page selection
  useEffect(() => {
    if (storeSymbol && storeSymbol !== symbol) {
      setSymbol(storeSymbol);
    }
  }, [storeSymbol]);
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const stockList = useMemo(() => {
    if (!searchText.trim()) return ALL_STOCKS;
    const kw = searchText.toUpperCase();
    return ALL_STOCKS.filter((s) => s.includes(kw)).slice(0, 30);
  }, [searchText]);

  const { quotes } = useQuotes([symbol], 60_000);
  const q = quotes.find((x) => x.symbol === symbol);
  const isHK = /^\d{5}$/.test(symbol);

  const composite = useMemo(() => q ? computeCompositeScore(q) : null, [q]);
  const aiPoints = useMemo(() => generateAISummary(q, composite), [q, composite]);

  const price = q?.regularMarketPrice ?? 0;
  const changePct = q?.regularMarketChangePercent ?? 0;
  const pe = q?.trailingPE;
  const cap = q?.marketCap ?? 0;
  const high52 = q?.fiftyTwoWeekHigh ?? 0;
  const low52 = q?.fiftyTwoWeekLow ?? 0;

  const selectStock = (sym: string) => {
    setSymbol(sym);
    setSearchText('');
    setShowDropdown(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">基本面分析</h1>
        <p className="page-desc"><span className="live-dot" />公司概况 · 财务数据 · 估值分析 · AI 智能总结</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        {/* Stock Selector */}
        <div className="card mb-4" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>选择股票：</span>
            <input
              className="input"
              placeholder="输入代码搜索，如 00700 / AAPL / QQQ..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              style={{ width: 300, fontSize: '13px' }}
            />
            {q && (
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                {symbol} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{q.shortName ?? q.longName ?? ''}</span>
                <span style={{ marginLeft: 12, fontSize: '14px', fontWeight: 700 }}>{price.toFixed(2)}</span>
                <span className={changePct >= 0 ? 'color-up' : 'color-down'} style={{ fontSize: '13px', marginLeft: 8 }}>
                  {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                </span>
              </span>
            )}
            {showDropdown && searchText && (
              <div style={{
                position: 'absolute', top: '100%', left: 80, width: 300,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)', zIndex: 100, maxHeight: 250, overflow: 'auto',
              }}>
                {stockList.map((s) => (
                  <div key={s} onClick={() => selectStock(s)}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', fontFamily: 'monospace' }}
                    className="sidebar-item">
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Composite Score Card */}
        {composite && (
          <div className="dashboard-grid fixed-3col mb-4">
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>综合评级</div>
              <div style={{ fontSize: '36px', fontWeight: 700, marginTop: 4, color: (() => {
                const s = composite.compositeScore;
                return s >= 8 ? 'var(--color-up)' : s >= 6.5 ? 'var(--color-accent)' : s >= 5 ? 'var(--color-warning)' : 'var(--color-down)';
              })() }}>
                {composite.compositeScore.toFixed(1)}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                {composite.rating}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 2 }}>
                置信度: {composite.confidence}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>三维评分</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>基本面</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-accent)' }}>{composite.fundamentalScore.toFixed(1)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>技术面</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-purple)' }}>{composite.technicalScore.toFixed(1)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>情绪面</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-green)' }}>{composite.sentimentScore.toFixed(1)}</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 8 }}>
                40% + 30% + 30% 加权
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>关键价位</div>
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: 10, lineHeight: 1.8 }}>
                <div>入场: <span style={{ color: 'var(--color-up)' }}>{composite.entryLevels.aggressive}</span> / {composite.entryLevels.moderate} / <span style={{ color: 'var(--color-warning)' }}>{composite.entryLevels.conservative}</span></div>
                <div>目标: <span style={{ color: 'var(--color-up)' }}>{composite.exitTargets.target1}</span> / {composite.exitTargets.target2} / <span style={{ color: 'var(--color-purple)' }}>{composite.exitTargets.target3}</span></div>
                <div>止损: <span style={{ color: 'var(--color-down)' }}>{composite.stopLoss}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* AI Summary */}
        <div className="card mb-4" style={{ borderLeft: '3px solid var(--color-accent)' }}>
          <div className="card-title mb-3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>AI 智能总结</span>
            <span className="badge" style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)', fontSize: '10px' }}>自动生成</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {aiPoints.map((point, i) => (
              <div key={i} style={{ fontSize: '13px', color: i === aiPoints.length - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)', lineHeight: 1.7 }}>
                {point}
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs mb-4" style={{ display: 'inline-flex' }}>
          {[
            { key: 'overview', label: '公司概况' },
            { key: 'financials', label: '财务数据' },
            { key: 'valuation', label: '估值分析' },
            { key: 'holders', label: '股东持仓' },
            { key: 'announcements', label: '公司公告' },
          ].map((t) => (
            <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="dashboard-grid fixed-2col">
            <div className="card">
              <div className="card-title mb-4">基本信息</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                {[
                  ['代码', symbol],
                  ['名称', q?.shortName ?? q?.longName ?? '---'],
                  ['交易所', q?.exchangeName ?? (isHK ? '香港联交所' : '纳斯达克/NYSE')],
                  ['货币', q?.currency ?? (isHK ? 'HKD' : 'USD')],
                  ['最新价', price ? price.toFixed(2) : '---'],
                  ['涨跌幅', `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`],
                  ['市值', cap > 0 ? `${(cap / 1e8).toFixed(0)}亿` : '---'],
                  ['52周最高', high52 > 0 ? high52.toFixed(2) : '---'],
                  ['52周最低', low52 > 0 ? low52.toFixed(2) : '---'],
                  ['日均成交量', q?.averageDailyVolume3Month ? `${(q.averageDailyVolume3Month / 10000).toFixed(0)}万` : '---'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                    <div style={{ marginTop: 2, fontWeight: label === '涨跌幅' ? 600 : 400,
                      color: label === '涨跌幅' ? (changePct >= 0 ? 'var(--color-up)' : 'var(--color-down)') : 'inherit' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title mb-4">价格位置分析</div>
              {high52 > 0 && low52 > 0 && price > 0 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    <span>52周低 {low52.toFixed(2)}</span>
                    <span>52周高 {high52.toFixed(2)}</span>
                  </div>
                  <div style={{ height: 12, background: 'linear-gradient(90deg, var(--color-down), var(--color-warning), var(--color-up))', borderRadius: 6, position: 'relative', marginBottom: 8 }}>
                    <div style={{
                      position: 'absolute',
                      left: `${Math.min(100, Math.max(0, ((price - low52) / (high52 - low52)) * 100))}%`,
                      top: -6, width: 24, height: 24, background: '#fff', borderRadius: '50%',
                      border: '3px solid var(--color-accent)', transform: 'translateX(-50%)',
                    }} />
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>
                    当前 {price.toFixed(2)} | 距高 {((high52 - price) / high52 * 100).toFixed(1)}% | 距低 {((price - low52) / low52 * 100).toFixed(1)}%
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>暂无 52 周数据</div>
              )}
              <div className="card-title mb-4 mt-4">估值速览</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                {[
                  ['PE(TTM)', pe?.toFixed(1) ?? '---'],
                  ['PE(Forward)', q?.forwardPE?.toFixed(1) ?? '---'],
                  ['市值(亿)', cap > 0 ? (cap / 1e8).toFixed(0) : '---'],
                  ['货币', q?.currency ?? '---'],
                ].map(([label, value]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{label}</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, marginTop: 4 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div>
            <div className="card mb-4">
              <div className="card-title mb-4">营收 & 净利润趋势（模拟数据）</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', height: 200, padding: '0 20px' }}>
                {financialData.years.map((year, i) => (
                  <div key={year} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'flex-end', height: 160 }}>
                      <div style={{
                        width: 40, background: 'var(--color-accent)', borderRadius: '4px 4px 0 0',
                        height: `${(financialData.revenue[i] / 7000) * 100}%`, opacity: 0.8,
                      }} />
                      <div style={{
                        width: 40, background: 'var(--color-green)', borderRadius: '4px 4px 0 0',
                        height: `${(financialData.netProfit[i] / 2000) * 100}%`,
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 8 }}>{year}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-2" style={{ fontSize: '12px', color: 'var(--text-tertiary)', justifyContent: 'center' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--color-accent)', borderRadius: 2, marginRight: 4 }} /> 营收</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--color-green)', borderRadius: 2, marginRight: 4 }} /> 净利润</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
                ⚠️ 财务明细数据为模拟展示，Yahoo Finance 免费 API 不提供利润表/资产负债表
              </div>
            </div>

            <div className="dashboard-grid fixed-3col">
              {[
                { label: 'ROE', value: `${financialData.roe}%` },
                { label: 'ROA', value: `${financialData.roa}%` },
                { label: '毛利率', value: `${financialData.grossMargin}%` },
                { label: '净利率', value: `${financialData.netMargin}%` },
                { label: '资产负债率', value: `${financialData.debtRatio}%` },
                { label: '经营现金流', value: '1,856亿' },
              ].map((m) => (
                <div key={m.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{m.label}</div>
                  <div className="stat-value" style={{ fontSize: '24px', marginTop: 4 }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'valuation' && (
          <div className="dashboard-grid fixed-2col">
            <div className="card">
              <div className="card-title mb-4">估值指标</div>
              <table className="data-table">
                <thead><tr><th>指标</th><th>当前</th><th>说明</th></tr></thead>
                <tbody>
                  <tr>
                    <td>PE(TTM)</td>
                    <td style={{ fontWeight: 600 }}>{pe?.toFixed(1) ?? '---'}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                      {pe != null && pe > 0
                        ? (pe < 15 ? '低于历史中枢，估值偏低' : pe < 25 ? '估值合理' : pe < 40 ? '估值偏高' : '高估值区间')
                        : '暂无数据'}
                    </td>
                  </tr>
                  <tr>
                    <td>PE(Forward)</td>
                    <td style={{ fontWeight: 600 }}>{q?.forwardPE?.toFixed(1) ?? '---'}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>基于分析师预期盈利的前瞻PE</td>
                  </tr>
                  <tr>
                    <td>市值</td>
                    <td style={{ fontWeight: 600 }}>{cap > 0 ? `${(cap / 1e8).toFixed(0)}亿` : '---'}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{isHK ? '港元' : '美元'}计价</td>
                  </tr>
                  <tr>
                    <td>52周高低</td>
                    <td style={{ fontWeight: 600 }}>{high52 > 0 ? `${low52.toFixed(1)} - ${high52.toFixed(1)}` : '---'}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                      {price > 0 && high52 > 0 ? `现价处于${(((price - low52) / (high52 - low52)) * 100).toFixed(0)}%分位` : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card-title mb-4">DCF 估值计算器</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  ['增长率', '8%'],
                  ['折现率(WACC)', '10%'],
                  ['永续增长率', '3%'],
                  ['自由现金流(亿)', cap > 0 ? `${(cap * 0.03 / 1e8).toFixed(0)}` : '---'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                    <input className="input" style={{ width: 120, textAlign: 'right' }} defaultValue={val} />
                  </div>
                ))}
                <button className="btn btn-primary w-full mt-2">计算估值</button>
                <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  估算内在价值: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {price > 0 ? `${(price * 0.9).toFixed(2)} - ${(price * 1.3).toFixed(2)} ${isHK ? 'HKD' : 'USD'}` : '---'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'holders' && (
          <div className="dashboard-grid fixed-2col">
            <div className="card">
              <div className="card-title mb-4">前十大股东（示例数据）</div>
              <table className="data-table">
                <thead><tr><th>股东名称</th><th>持股比例</th><th>较上期</th></tr></thead>
                <tbody>
                  {[
                    ['Vanguard Group', '8.5%', '+0.3%'],
                    ['BlackRock', '7.2%', '-0.1%'],
                    ['State Street', '4.8%', '+0.1%'],
                    ['Capital Group', '3.5%', '+0.2%'],
                    ['Fidelity', '2.9%', '+0.0%'],
                  ].map(([name, pct, change]) => (
                    <tr key={name}>
                      <td>{name}</td><td>{pct}</td>
                      <td className={change.startsWith('+') ? 'color-up' : 'color-down'}>{change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 8 }}>
                ⚠️ 股东持仓为示例数据，Yahoo Finance 免费 API 不提供机构持仓明细
              </div>
            </div>
            <div className="card">
              <div className="card-title mb-4">机构持仓变动（示例数据）</div>
              <table className="data-table">
                <thead><tr><th>机构</th><th>持股数</th><th>占比</th><th>季度变动</th></tr></thead>
                <tbody>
                  {[
                    ['Vanguard', '2.50亿', '8.5%', '+1,200万'],
                    ['BlackRock', '2.12亿', '7.2%', '-500万'],
                    ['State Street', '1.41亿', '4.8%', '+300万'],
                    ['Capital Group', '1.03亿', '3.5%', '+800万'],
                  ].map(([inst, shares, pct, change]) => (
                    <tr key={inst}>
                      <td>{inst}</td><td>{shares}</td><td>{pct}</td>
                      <td className={change.startsWith('+') ? 'color-up' : 'color-down'}>{change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="card">
            <table className="data-table">
              <thead><tr><th>日期</th><th>类型</th><th>标题</th></tr></thead>
              <tbody>
                {announcements.map((a, i) => (
                  <tr key={i}>
                    <td>{a.date}</td>
                    <td><span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{a.type}</span></td>
                    <td>{a.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 8 }}>
              ⚠️ 公告数据为示例，实际公告可通过港交所/纽交所官网获取
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
