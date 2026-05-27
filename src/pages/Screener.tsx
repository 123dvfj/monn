import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuotes, ALL_HK_STOCKS, ALL_US_STOCKS } from '../hooks/useStockData';
import type { YQuote } from '../services/yahooFinance';
import { computeCompositeScore, scoreToRating } from '../utils/scoring';
import type { CompositeResult } from '../utils/scoring';
import { useCountUp } from '../hooks/useCountUp';
import { useT } from '../i18n/I18nContext';
import { callAI } from '../utils/aiChat';
import type { AIConfig } from '../utils/aiChat';

interface FilterCondition {
  id: string;
  name: string;
  enabled: boolean;
  min: string;
  max: string;
  field: keyof YQuote;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const ALL_STOCKS_FULL = [...ALL_HK_STOCKS, ...ALL_US_STOCKS];
const INITIAL_SCREENER_STOCKS = [...ALL_HK_STOCKS.slice(0, 20), ...ALL_US_STOCKS.slice(0, 20)];

function analyzeScreenerResults(results: YQuote[]): {
  topByChange: YQuote[];
  topByVolume: YQuote[];
  avgPE: number;
  upCount: number;
  downCount: number;
} {
  const withPrice = results.filter((q) => q.regularMarketPrice > 0);
  const topByChange = [...withPrice].sort((a, b) => (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0)).slice(0, 5);
  const topByVolume = [...withPrice].sort((a, b) => (b.regularMarketVolume ?? 0) - (a.regularMarketVolume ?? 0)).slice(0, 5);
  const peValues = withPrice.filter((q) => (q.trailingPE ?? 0) > 0).map((q) => q.trailingPE!);
  const avgPE = peValues.length > 0 ? peValues.reduce((a, b) => a + b, 0) / peValues.length : 0;
  const upCount = withPrice.filter((q) => (q.regularMarketChangePercent ?? 0) > 0).length;
  const downCount = withPrice.filter((q) => (q.regularMarketChangePercent ?? 0) < 0).length;
  return { topByChange, topByVolume, avgPE, upCount, downCount };
}

function generateRecommendations(quotes: YQuote[]): CompositeResult[] {
  const valid = quotes.filter((q) => q.regularMarketPrice > 0);
  if (valid.length === 0) return [];

  return valid
    .map((q) => computeCompositeScore(q))
    .filter((r): r is CompositeResult => r !== null)
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, 10);
}

function generateRiskAlerts(quotes: YQuote[]): { symbol: string; name: string; risk: string; level: 'high' | 'medium'; score: number }[] {
  return quotes
    .filter((q) => q.regularMarketPrice > 0)
    .map((q) => {
      const pe = q.trailingPE ?? 0;
      const chg = q.regularMarketChangePercent ?? 0;
      const high52 = q.fiftyTwoWeekHigh ?? 0;
      const price = q.regularMarketPrice ?? 0;
      const vol = q.regularMarketVolume ?? 0;
      const avgVol = q.averageDailyVolume3Month ?? 0;

      const risks: string[] = [];
      let level: 'high' | 'medium' = 'medium';
      let score = 0;

      if (pe > 50) { risks.push('PE过高(>50)'); level = 'high'; score += 3; }
      if (chg < -3) { risks.push('放量下跌'); level = 'high'; score += 3; }
      if (high52 > 0 && price > 0 && price > high52 * 0.95) { risks.push('接近52周高位'); score += 2; }
      if (pe < 0) { risks.push('亏损状态'); level = 'high'; score += 3; }
      if (avgVol > 0 && vol > avgVol * 2 && chg < 0) { risks.push('放量下跌'); level = 'high'; score += 2; }
      if (price > 0 && high52 > 0 && price < high52 * 0.6) { risks.push('距52周高回撤>40%'); score += 2; }

      return { symbol: q.symbol ?? '', name: (q.shortName ?? '').slice(0, 16), risk: risks.join(' · ') || '暂无显著风险信号', level, score };
    })
    .filter((r) => r.risk !== '暂无显著风险信号')
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// Rule-based financial Q&A (works without API key)
function localFinancialQA(question: string, quotes: YQuote[]): string {
  const q = question.toLowerCase();
  const valid = quotes.filter((s) => s.regularMarketPrice > 0);

  // Market overview
  if (q.includes('市场') && (q.includes('概览') || q.includes('整体') || q.includes('怎么样'))) {
    const up = valid.filter((s) => (s.regularMarketChangePercent ?? 0) > 0).length;
    const down = valid.filter((s) => (s.regularMarketChangePercent ?? 0) < 0).length;
    const topGainer = [...valid].sort((a, b) => (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0))[0];
    return `当前扫描 ${valid.length} 只股票：上涨 ${up} 只，下跌 ${down} 只。领涨: ${topGainer?.symbol} (${topGainer?.shortName}) +${topGainer?.regularMarketChangePercent?.toFixed(2)}%。市场情绪${up > down ? '偏积极' : '偏谨慎'}。`;
  }

  // Best PE
  if (q.includes('最低估') || q.includes('最低pe') || q.includes('便宜') || q.includes('价值')) {
    const cheap = [...valid].filter((s) => (s.trailingPE ?? 0) > 0).sort((a, b) => (a.trailingPE ?? 99) - (b.trailingPE ?? 99)).slice(0, 5);
    if (cheap.length === 0) return '当前暂无PE数据可供分析。';
    return '最低PE（最具安全边际）股票：\n' + cheap.map((s) => `${s.symbol} ${s.shortName} PE:${s.trailingPE?.toFixed(1)}`).join('\n');
  }

  // Best momentum
  if (q.includes('涨得') || q.includes('领涨') || q.includes('强势') || q.includes('涨幅')) {
    const top = [...valid].sort((a, b) => (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0)).slice(0, 5);
    return '今日涨幅前5：\n' + top.map((s) => `${s.symbol} ${s.shortName} +${s.regularMarketChangePercent?.toFixed(2)}%`).join('\n');
  }

  // Worst performers
  if (q.includes('跌') || q.includes('领跌') || q.includes('弱势') || q.includes('跌幅')) {
    const worst = [...valid].sort((a, b) => (a.regularMarketChangePercent ?? 0) - (b.regularMarketChangePercent ?? 0)).slice(0, 5);
    return '今日跌幅前5：\n' + worst.map((s) => `${s.symbol} ${s.shortName} ${s.regularMarketChangePercent?.toFixed(2)}%`).join('\n');
  }

  // High volume
  if (q.includes('成交') || q.includes('放量') || q.includes('活跃')) {
    const active = [...valid].sort((a, b) => (b.regularMarketVolume ?? 0) - (a.regularMarketVolume ?? 0)).slice(0, 5);
    return '今日成交最活跃：\n' + active.map((s) => `${s.symbol} ${s.shortName} 成交量:${((s.regularMarketVolume ?? 0) / 10000).toFixed(0)}万`).join('\n');
  }

  // ETF specific
  if (q.includes('etf') || q.includes('ETF') || q.includes('指数基金')) {
    const etfs = ['SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO', 'TQQQ', 'SQQQ', 'FXI', 'KWEB', 'GLD', 'TLT', 'XLK', 'XLF', 'XLE'];
    const etfData = valid.filter((s) => etfs.includes(s.symbol ?? ''));
    return 'ETF 行情概览：\n' + etfData.map((s) => `${s.symbol} ${s.shortName}: $${s.regularMarketPrice?.toFixed(2)} ${s.regularMarketChangePercent >= 0 ? '+' : ''}${s.regularMarketChangePercent?.toFixed(2)}%`).join('\n');
  }

  // Default: search specific stock
  const mentioned = valid.filter((s) => question.toUpperCase().includes(s.symbol ?? ''));
  if (mentioned.length > 0) {
    const s = mentioned[0];
    const composite = computeCompositeScore(s);
    const pe = s.trailingPE;
    const price = s.regularMarketPrice;
    const chg = s.regularMarketChangePercent ?? 0;
    const cap = s.marketCap ? (s.marketCap / 1e8).toFixed(0) : '---';
    const high52 = s.fiftyTwoWeekHigh ?? 0;
    const low52 = s.fiftyTwoWeekLow ?? 0;
    let resp = `${s.symbol} ${s.shortName} 当前价: ${price?.toFixed(2)} | ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
    if (pe && pe > 0) resp += `\nPE(TTM): ${pe.toFixed(1)} (${pe < 15 ? '低估' : pe < 25 ? '合理' : pe < 40 ? '偏高' : '高估'})`;
    resp += `\n市值: ${cap}亿 | 52周区间: ${low52.toFixed(1)}-${high52.toFixed(1)}`;
    if (composite) {
      resp += `\n\n综合评级: ${composite.rating} (${composite.compositeScore.toFixed(1)}/10) 置信度: ${composite.confidence}`;
      resp += `\n基本面 ${composite.fundamentalScore.toFixed(1)} | 技术面 ${composite.technicalScore.toFixed(1)} | 情绪面 ${composite.sentimentScore.toFixed(1)}`;
      resp += `\n入场: ${composite.entryLevels.aggressive}/${composite.entryLevels.moderate}/${composite.entryLevels.conservative}`;
      resp += `\n目标: ${composite.exitTargets.target1}/${composite.exitTargets.target2}/${composite.exitTargets.target3} | 止损: ${composite.stopLoss}`;
    }
    return resp;
  }

  return `基于当前 ${valid.length} 只股票数据，我可以回答以下问题：\n• "市场整体怎么样？"\n• "哪些股票最低估？"\n• "今日领涨/领跌？"\n• "成交最活跃？"\n• "ETF行情？"\n• 输入具体股票代码查询（如 "00700" 或 "AAPL"）`;
}

export default function Screener() {
  const { t } = useT();
  const [fetchAll, setFetchAll] = useState(false);
  const fetchSymbols = fetchAll ? ALL_STOCKS_FULL : INITIAL_SCREENER_STOCKS;
  const { quotes, loading } = useQuotes(fetchSymbols, 60_000);
  const [activeTab, setActiveTab] = useState('screener');

  // ---- Screener state ----
  const [filters, setFilters] = useState<FilterCondition[]>([
    { id: 'changePct', name: '涨跌幅 %', enabled: false, min: '2', max: '20', field: 'regularMarketChangePercent' },
    { id: 'pe', name: 'PE(TTM)', enabled: false, min: '0', max: '30', field: 'trailingPE' },
    { id: 'price', name: '股价', enabled: false, min: '10', max: '500', field: 'regularMarketPrice' },
    { id: 'volume', name: '成交量(万)', enabled: false, min: '500', max: '', field: 'regularMarketVolume' },
    { id: 'marketCap', name: '市值(亿)', enabled: false, min: '100', max: '', field: 'marketCap' },
    { id: 'market', name: '市场', enabled: false, min: '', max: '', field: 'exchangeName' as any },
  ]);
  const [marketSelect, setMarketSelect] = useState('ALL');

  const updateFilter = (id: string, changes: Partial<FilterCondition>) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...changes } : f)));
  };
  const toggleFilter = (id: string) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
  };

  const results = useMemo(() => {
    return quotes.filter((q) => {
      const sym = q.symbol ?? '';
      const isHK = /^\d{5}$/.test(sym);
      if (marketSelect === 'HK' && !isHK) return false;
      if (marketSelect === 'US' && isHK) return false;
      for (const f of filters) {
        if (!f.enabled) continue;
        if (f.id === 'market') continue;
        if (f.id === 'volume') {
          const vol = (q.regularMarketVolume ?? 0) / 10000;
          if (f.min && vol < Number(f.min)) return false;
          if (f.max && vol > Number(f.max)) return false;
          continue;
        }
        if (f.id === 'marketCap') {
          const cap = (q.marketCap ?? 0) / 1e8;
          if (f.min && cap < Number(f.min)) return false;
          if (f.max && cap > Number(f.max)) return false;
          continue;
        }
        const val = q[f.field] as number;
        if (val == null || val === 0) return false;
        if (f.min && val < Number(f.min)) return false;
        if (f.max && val > Number(f.max)) return false;
      }
      return true;
    });
  }, [quotes, filters, marketSelect]);

  const sortedResults = useMemo(() => [...results].sort((a, b) => (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0)), [results]);

  // ---- AI Recommendations (real-time, based on full data) ----
  const recommendations = useMemo(() => generateRecommendations(quotes), [quotes]);
  const riskAlerts = useMemo(() => generateRiskAlerts(quotes), [quotes]);

  // ---- AI Chat ----
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好！我是 Monn AI 助手。我可以基于实时数据回答股票相关问题。\n\n试着问我："市场整体怎么样？"、"哪些股票最低估？"、"ETF行情"、或输入股票代码。' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('monn_ai_key') || '');
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('monn_ai_url') || 'https://api.openai.com/v1/chat/completions');
  const [model, setModel] = useState(() => localStorage.getItem('monn_ai_model') || 'gpt-4o-mini');
  const [provider, setProvider] = useState<'openai' | 'anthropic'>(
    () => (localStorage.getItem('monn_ai_provider') as 'openai' | 'anthropic') || 'openai'
  );
  const [showConfig, setShowConfig] = useState(!apiKey);
  const [configMsg, setConfigMsg] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');

    // Try remote AI model if API key is configured
    if (apiKey.trim()) {
      try {
        const aiConfig: AIConfig = { apiKey, apiUrl, model, provider };
        const systemMsg = `你是一个专业的股票分析助手，可访问以下${quotes.filter(q => q.regularMarketPrice > 0).length}只港美股实时数据。简短回答，中文优先。`;
        const reply = await callAI(aiConfig, [
          { role: 'system', content: systemMsg },
          ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMsg.content },
        ], { maxTokens: 500 });
        setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        return;
      } catch (e: any) {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: `远程模型调用失败 (${e.message || '网络错误'})，以下为本地分析结果：\n\n${localFinancialQA(userMsg.content, quotes)}` }]);
        return;
      }
    }

    // Local rule-based analysis
    await new Promise((r) => setTimeout(r, 500));
    const reply = localFinancialQA(userMsg.content, quotes);
    setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const saveApiConfig = () => {
    localStorage.setItem('monn_ai_key', apiKey);
    localStorage.setItem('monn_ai_url', apiUrl);
    localStorage.setItem('monn_ai_model', model);
    localStorage.setItem('monn_ai_provider', provider);
    setConfigMsg('配置已保存');
    setShowConfig(false);
    setTimeout(() => setConfigMsg(''), 2000);
  };

  const handleProviderChange = (p: 'openai' | 'anthropic') => {
    setProvider(p);
    if (p === 'anthropic') {
      setModel('claude-sonnet-4-6');
      setApiUrl('https://api.anthropic.com/v1/messages');
    } else {
      setModel('gpt-4o-mini');
      setApiUrl('https://api.openai.com/v1/chat/completions');
    }
  };

  const enabledCount = filters.filter((f) => f.enabled).length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI 智能选股</h1>
        <p className="page-desc">
          {loading ? '加载数据中...' : <><span className="live-dot" />条件筛选 · AI推荐 · AI问答 · {quotes.filter(q => q.regularMarketPrice > 0).length}/{fetchAll ? ALL_STOCKS_FULL.length : INITIAL_SCREENER_STOCKS.length} 只股票{!fetchAll ? <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setFetchAll(true)}>加载全部 {ALL_STOCKS_FULL.length} 只</button> : null}</>}
        </p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        {/* Tabs */}
        <div className="tabs mb-4" style={{ display: 'inline-flex' }}>
          {[
            { key: 'screener', label: '条件筛选' },
            { key: 'recommend', label: 'AI 推荐' },
            { key: 'chat', label: 'AI 问答' },
          ].map((t) => (
            <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== TAB: Screener ===== */}
        {activeTab === 'screener' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
            <div>
              <div className="card mb-4">
                <div className="card-title mb-3">市场</div>
                <div className="tabs" style={{ display: 'inline-flex' }}>
                  {['ALL', 'HK', 'US'].map((m) => (
                    <button key={m} className={`tab ${marketSelect === m ? 'active' : ''}`} onClick={() => setMarketSelect(m)}>
                      {{ ALL: '全部', HK: '港股', US: '美股' }[m]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card mb-4">
                <div className="card-title mb-4">筛选条件</div>
                {filters.map((f) => (
                  <div key={f.id} style={{ marginBottom: 12 }}>
                    <div className="flex justify-between items-center" style={{ padding: '6px 0', cursor: 'pointer' }}
                      onClick={() => toggleFilter(f.id)}>
                      <span style={{ fontSize: '13px', fontWeight: f.enabled ? 600 : 400, color: f.enabled ? 'var(--color-accent)' : 'var(--text-secondary)' }}>
                        {f.enabled ? '✓ ' : ''}{f.name}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{f.enabled ? '启用' : '点击启用'}</span>
                    </div>
                    {f.enabled && f.id !== 'market' && (
                      <div className="flex gap-2 mt-1">
                        <input className="input" placeholder="最小" value={f.min}
                          onChange={(e) => updateFilter(f.id, { min: e.target.value })}
                          style={{ width: '50%', fontSize: '12px', padding: '4px 8px' }} />
                        <input className="input" placeholder="最大" value={f.max}
                          onChange={(e) => updateFilter(f.id, { max: e.target.value })}
                          style={{ width: '50%', fontSize: '12px', padding: '4px 8px' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-title mb-4">快捷方案</div>
                {[
                  { name: '低估值高成长', apply: () => {
                    setMarketSelect('ALL');
                    setFilters(filters.map((f) => {
                      if (f.id === 'pe') return { ...f, enabled: true, min: '0', max: '20' };
                      if (f.id === 'changePct') return { ...f, enabled: true, min: '2', max: '20' };
                      return { ...f, enabled: false };
                    }));
                  }},
                  { name: '超跌反弹', apply: () => {
                    setMarketSelect('ALL');
                    setFilters(filters.map((f) => {
                      if (f.id === 'changePct') return { ...f, enabled: true, min: '-20', max: '-2' };
                      if (f.id === 'volume') return { ...f, enabled: true, min: '500', max: '' };
                      return { ...f, enabled: false };
                    }));
                  }},
                  { name: '高成交活跃', apply: () => {
                    setMarketSelect('ALL');
                    setFilters(filters.map((f) => {
                      if (f.id === 'volume') return { ...f, enabled: true, min: '1000', max: '' };
                      if (f.id === 'price') return { ...f, enabled: true, min: '10', max: '1000' };
                      return { ...f, enabled: false };
                    }));
                  }},
                ].map((s) => (
                  <div key={s.name} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                    onClick={s.apply}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 2 }}>点击应用</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">选股结果 ({sortedResults.length})</span>
                  <button className="btn btn-sm" onClick={() => {
                    const csv = ['代码,名称,市场,最新价,涨跌幅%,PE,市值'];
                    sortedResults.forEach((s: any) => {
                      const sym = s.symbol ?? '';
                      const name = (s.shortName ?? '').replace(/,/g, '');
                      const isHK = /^\d{5}$/.test(sym);
                      csv.push(`${sym},${name},${isHK ? 'HK' : 'US'},${s.regularMarketPrice ?? 0},${s.regularMarketChangePercent ?? 0},${s.trailingPE ?? ''},${s.marketCap ? s.marketCap / 1e8 : ''}`);
                    });
                    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob); a.download = 'screener_results.csv'; a.click();
                  }}>导出CSV</button>
                </div>
                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>加载中...</div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>代码</th><th>名称</th><th>市场</th><th>最新价</th><th>涨跌幅</th><th>PE</th><th>市值(亿)</th></tr></thead>
                    <tbody>
                      {sortedResults.slice(0, 100).map((s: any) => {
                        const sym = s.symbol ?? '';
                        const name = s.shortName ?? s.longName ?? '';
                        const isHK = /^\d{5}$/.test(sym);
                        return (
                          <tr key={sym}>
                            <td style={{ color: 'var(--color-accent)' }}>{sym}</td>
                            <td>{(name ?? '').length > 20 ? (name ?? '').slice(0, 18) + '..' : name}</td>
                            <td><span className="badge" style={{ background: isHK ? '#a371f722' : '#58a6ff22', color: isHK ? 'var(--color-purple)' : 'var(--color-accent)', fontSize: '10px' }}>{isHK ? 'HK' : 'US'}</span></td>
                            <td className="font-mono">{(s.regularMarketPrice ?? 0).toFixed(2)}</td>
                            <td className={(s.regularMarketChangePercent ?? 0) >= 0 ? 'color-up' : 'color-down'}>
                              {(s.regularMarketChangePercent ?? 0) >= 0 ? '+' : ''}{(s.regularMarketChangePercent ?? 0).toFixed(2)}%
                            </td>
                            <td>{s.trailingPE?.toFixed(1) ?? '-'}</td>
                            <td>{s.marketCap ? (s.marketCap / 1e8).toFixed(0) : '-'}</td>
                          </tr>
                        );
                      })}
                      {sortedResults.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>没有符合条件的股票，请调整筛选条件</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB: AI Recommend ===== */}
        {activeTab === 'recommend' && (
          <div>
            {/* Market Stats */}
            <div className="dashboard-grid fixed-3col mb-4">
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t('aiCompositeScore')}</div>
                <div className="stat-value" style={{ fontSize: '32px', marginTop: 8, color: (() => {
                  const s = recommendations[0]?.compositeScore ?? 0;
                  return s >= 8 ? 'var(--color-up)' : s >= 6.5 ? 'var(--color-accent)' : s >= 5 ? 'var(--color-warning)' : 'var(--color-down)';
                })() }}>
                  {recommendations.length > 0 ? recommendations[0].compositeScore.toFixed(1) : '---'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {recommendations[0] ? `${recommendations[0].symbol} · ${recommendations[0].rating}` : '加载中'}
                </div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>市场情绪</div>
                <div className="stat-value" style={{ fontSize: '32px', marginTop: 8, color: (() => {
                  const up = quotes.filter(s => (s.regularMarketChangePercent ?? 0) > 0).length;
                  const down = quotes.filter(s => (s.regularMarketChangePercent ?? 0) < 0).length;
                  return up > down ? 'var(--color-up)' : 'var(--color-down)';
                })() }}>
                  {(() => {
                    const up = quotes.filter(s => (s.regularMarketChangePercent ?? 0) > 0).length;
                    const down = quotes.filter(s => (s.regularMarketChangePercent ?? 0) < 0).length;
                    return up > down ? '偏多 ↑' : '偏空 ↓';
                  })()}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  ↑{quotes.filter(s => (s.regularMarketChangePercent ?? 0) > 0).length} / ↓{quotes.filter(s => (s.regularMarketChangePercent ?? 0) < 0).length}
                </div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>风险信号</div>
                <div className="stat-value" style={{ fontSize: '32px', marginTop: 8, color: riskAlerts.length > 3 ? 'var(--color-down)' : 'var(--color-up)' }}>
                  {riskAlerts.length}只
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {riskAlerts.length < 3 ? '风险可控' : riskAlerts.length < 6 ? '适度关注' : '需警惕'}
                </div>
              </div>
            </div>

            {/* AI Recommendations with Multi-Factor Scoring */}
            <div className="card mb-4">
              <div className="card-title mb-2">AI 股票推荐（40%基本面 + 30%技术面 + 30%情绪面）</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: 16 }}>
                复合评分 · 3档入场价位 · 3档离场目标 · 止损位 · 数据来源: Yahoo Finance
              </div>
              {recommendations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>加载中...</div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {recommendations.map((rec) => {
                    const scoreColor = rec.compositeScore >= 8 ? 'var(--color-up)' :
                      rec.compositeScore >= 6.5 ? 'var(--color-accent)' :
                      rec.compositeScore >= 5 ? 'var(--color-warning)' : 'var(--color-down)';
                    const ratingBg = rec.rating === 'STRONG BUY' ? 'var(--color-up-bg)' :
                      rec.rating === 'BUY' ? 'var(--color-accent-bg)' :
                      rec.rating === 'WATCH·HOLD' ? '#d2992222' : 'var(--color-down-bg)';
                    const ratingColor = rec.rating === 'STRONG BUY' ? 'var(--color-up)' :
                      rec.rating === 'BUY' ? 'var(--color-accent)' :
                      rec.rating === 'WATCH·HOLD' ? 'var(--color-warning)' : 'var(--color-down)';
                    return (
                      <div key={rec.symbol} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)', padding: '16px 20px',
                      }}>
                        {/* Header row */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-3 items-center">
                            <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-accent)' }}>{rec.symbol}</span>
                            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{rec.name}</span>
                            <span className="badge" style={{ background: ratingBg, color: ratingColor, fontSize: '12px', fontWeight: 600 }}>
                              {rec.rating} ({rec.compositeScore.toFixed(1)})
                            </span>
                            <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '10px' }}>
                              置信度: {rec.confidence}
                            </span>
                          </div>
                        </div>

                        {/* Score breakdown bar */}
                        <div className="flex gap-2 mb-3" style={{ alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', width: 56 }}>基本面</span>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${rec.fundamentalScore * 10}%`, height: '100%', background: 'var(--color-accent)', borderRadius: 3, transition: 'width 0.6s var(--ease-out-expo)' }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, width: 28, textAlign: 'right' }}>{rec.fundamentalScore.toFixed(1)}</span>
                        </div>
                        <div className="flex gap-2 mb-3" style={{ alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', width: 56 }}>技术面</span>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${rec.technicalScore * 10}%`, height: '100%', background: 'var(--color-purple)', borderRadius: 3, transition: 'width 0.6s var(--ease-out-expo)' }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, width: 28, textAlign: 'right' }}>{rec.technicalScore.toFixed(1)}</span>
                        </div>
                        <div className="flex gap-2 mb-3" style={{ alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', width: 56 }}>情绪面</span>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${rec.sentimentScore * 10}%`, height: '100%', background: 'var(--color-green)', borderRadius: 3, transition: 'width 0.6s var(--ease-out-expo)' }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, width: 28, textAlign: 'right' }}>{rec.sentimentScore.toFixed(1)}</span>
                        </div>

                        {/* Entry/Exit levels */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase' }}>入场价位</div>
                            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: 'var(--color-up)' }}>激进 {rec.entryLevels.aggressive}</span><br />
                              <span style={{ color: 'var(--color-accent)' }}>适中 {rec.entryLevels.moderate}</span><br />
                              <span style={{ color: 'var(--color-warning)' }}>保守 {rec.entryLevels.conservative}</span>
                            </div>
                          </div>
                          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase' }}>离场目标</div>
                            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: 'var(--color-up)' }}>T1 {rec.exitTargets.target1}</span><br />
                              <span style={{ color: 'var(--color-accent)' }}>T2 {rec.exitTargets.target2}</span><br />
                              <span style={{ color: 'var(--color-purple)' }}>T3 {rec.exitTargets.target3}</span>
                            </div>
                          </div>
                          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase' }}>风控</div>
                            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: 'var(--color-down)' }}>止损 {rec.stopLoss}</span><br />
                              <span style={{ color: 'var(--text-secondary)' }}>
                                盈亏比 {rec.riskReward.t1}/{rec.riskReward.t2}/{rec.riskReward.t3}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.5 }}>
                          {rec.summary}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Risk Alerts */}
            <div className="card">
              <div className="card-title mb-4">风险扫描 ({riskAlerts.length} 条信号)</div>
              {riskAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}>当前未检测到显著风险信号</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>代码</th><th>名称</th><th>风险信号</th><th>等级</th></tr></thead>
                  <tbody>
                    {riskAlerts.map((r) => (
                      <tr key={r.symbol}>
                        <td style={{ color: 'var(--color-accent)' }}>{r.symbol}</td>
                        <td>{r.name}</td>
                        <td style={{ fontSize: '12px' }}>{r.risk}</td>
                        <td><span className={`badge ${r.level === 'high' ? 'badge-down' : ''}`}
                          style={r.level === 'medium' ? { background: 'var(--color-warning)', color: '#fff' } : {}}>
                          {r.level === 'high' ? '高风险' : '中风险'}
                        </span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 8 }}>
                风险评分基于 PE、涨跌幅、52周位置、成交量等定量指标，仅供参考不构成投资建议。
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB: AI Chat ===== */}
        {activeTab === 'chat' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
            <div className="card" style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
              <div className="card-title mb-3">AI 问答助手</div>
              <div style={{ flex: 1, overflow: 'auto', marginBottom: 12, padding: '0 4px' }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    marginBottom: 12, padding: '8px 12px', borderRadius: 8,
                    background: msg.role === 'user' ? 'var(--color-accent-bg)' : 'var(--bg-tertiary)',
                    maxWidth: '90%', marginLeft: msg.role === 'user' ? 'auto' : 0,
                    fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input flex-1"
                  placeholder={apiKey ? '已连接远程模型，输入问题...' : '输入问题，如"市场整体怎么样？"...'}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ fontSize: '13px' }}
                />
                <button className="btn btn-primary" onClick={sendMessage}>发送</button>
              </div>
            </div>

            <div>
              <div className="card mb-4">
                <div className="card-title mb-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>API 配置（可选）</span>
                  <button className="btn btn-sm" onClick={() => setShowConfig(!showConfig)}>
                    {showConfig ? '收起' : '展开'}
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: 12 }}>
                  接入 OpenAI 兼容接口获得更智能的回答。不配置则使用本地规则引擎。
                </div>
                {showConfig && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>服务商</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {([
                          ['openai', 'OpenAI/兼容'],
                          ['anthropic', 'Anthropic'],
                        ] as const).map(([k, label]) => (
                          <button
                            key={k}
                            className={`btn btn-sm ${provider === k ? 'btn-primary' : ''}`}
                            onClick={() => handleProviderChange(k)}
                            style={{ fontSize: 11, padding: '4px 10px' }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input className="input" placeholder="API URL" value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)} style={{ fontSize: '11px' }} />
                    <input className="input" placeholder="模型名称" value={model}
                      onChange={(e) => setModel(e.target.value)} style={{ fontSize: '11px' }} />
                    <input className="input" type="password" placeholder="API Key" value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)} style={{ fontSize: '11px' }} />
                    <button className="btn btn-sm w-full btn-primary" onClick={saveApiConfig}>保存配置</button>
                    {configMsg && (
                      <div style={{ fontSize: 11, color: 'var(--color-up)', textAlign: 'center' }}>{configMsg}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-title mb-3">快捷提问</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    '市场整体怎么样？',
                    '哪些股票最低估？',
                    '今日领涨前5',
                    '今日成交最活跃',
                    'ETF行情',
                    '00700 分析',
                    'AAPL 分析',
                  ].map((q) => (
                    <div key={q} style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: 4, fontSize: '12px' }}
                      className="sidebar-item"
                      onClick={() => { setChatInput(q); }}>
                      {q}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card mt-4">
                <div className="card-title mb-3">免责声明</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                  AI 回答基于规则和数据自动生成，不构成投资建议。投资有风险，决策需谨慎。
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
