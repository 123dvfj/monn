import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChart, ColorType } from 'lightweight-charts';
import type { LineData, Time } from 'lightweight-charts';
import { useAuthStore } from '../stores/authStore';
import { usePortfolioStore } from '../stores/portfolioStore';
import { useQuotes, ALL_HK_STOCKS, ALL_US_STOCKS } from '../hooks/useStockData';
import { analyzePortfolio, computeSummary } from '../utils/portfolioAnalysis';
import { canTrade } from '../utils/marketHours';
import { callAI } from '../utils/aiChat';
import type { AIConfig } from '../utils/aiChat';
import { useConditionalOrderStore } from '../stores/conditionalOrderStore';
import type { ConditionalOrder, TriggerType } from '../stores/conditionalOrderStore';
import { useSessionHistoryStore } from '../stores/sessionHistoryStore';
import type { SavedSession } from '../stores/sessionHistoryStore';
import type { Transaction, Holding } from '../stores/portfolioStore';

const ALL_STOCKS = [...ALL_HK_STOCKS, ...ALL_US_STOCKS];

export default function Portfolio() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { balance, totalDeposited, holdings, transactions, buy, sell, deposit, withdraw, initUser, resetPortfolio } = usePortfolioStore();

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    initUser(user.username);
  }, [user]);

  // Trade form
  const [tradeSymbol, setTradeSymbol] = useState('');
  const [tradeShares, setTradeShares] = useState(100);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradeMsg, setTradeMsg] = useState('');
  const tradeMsgTimer = useRef<ReturnType<typeof setTimeout>>();
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showSymbolList, setShowSymbolList] = useState(false);

  const filteredSymbols = useMemo(() => {
    if (!symbolSearch.trim()) return ALL_STOCKS.slice(0, 20);
    return ALL_STOCKS.filter((s) => s.toUpperCase().includes(symbolSearch.toUpperCase())).slice(0, 20);
  }, [symbolSearch]);

  // Live quotes: holdings + current trade symbol
  const holdingSymbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const quoteSymbols = useMemo(() => {
    const set = new Set(holdingSymbols);
    if (tradeSymbol) set.add(tradeSymbol);
    return [...set];
  }, [holdingSymbols, tradeSymbol]);
  const { quotes } = useQuotes(quoteSymbols, 30_000);
  const quoteMap = useMemo(() => {
    const m: Record<string, typeof quotes[0]> = {};
    quotes.forEach((q) => { m[q.symbol] = q; });
    return m;
  }, [quotes]);

  const analyses = useMemo(
    () => analyzePortfolio(holdings, balance, quotes),
    [holdings, balance, quotes],
  );
  const summary = useMemo(() => computeSummary(analyses, balance), [analyses, balance]);

  const tradeQuote = tradeSymbol ? quoteMap[tradeSymbol] : undefined;
  const tradePrice = tradeQuote?.regularMarketPrice ?? 0;
  const tradeTotal = tradePrice * tradeShares;
  const holdingInfo = holdings.find((h) => h.symbol === tradeSymbol);

  // Market status for selected symbol
  const tradeMarket = tradeSymbol ? canTrade(tradeSymbol) : null;

  // Conditional orders
  const { orders, addOrder, cancelOrder, resetOrders } = useConditionalOrderStore();
  const pendingOrders = useMemo(() => orders.filter((o) => o.status === 'pending'), [orders]);

  // Reset & Save session
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const { saveSession, sessions: savedSessions } = useSessionHistoryStore();

  const handleReset = async (save: boolean) => {
    if (save) {
      setResetSaving(true);
      // Build chart data from transactions for the session record
      const sorted = [...transactions].reverse();
      const points: LineData[] = [];
      let cash = totalDeposited;
      const tempHeld: Record<string, number> = {};
      for (const txn of sorted) {
        if (txn.type === 'buy') { cash -= txn.total; tempHeld[txn.symbol] = (tempHeld[txn.symbol] || 0) + txn.shares; }
        else if (txn.type === 'sell') { cash += txn.total; tempHeld[txn.symbol] = (tempHeld[txn.symbol] || 0) - txn.shares; }
        else if (txn.type === 'deposit') { cash += txn.total; }
        else if (txn.type === 'withdraw') { cash -= txn.total; }
        const hv = Object.entries(tempHeld).reduce((s, [sym, sh]) => {
          const q = quoteMap[sym];
          return s + (sh > 0 ? sh * (q?.regularMarketPrice ?? 0) : 0);
        }, 0);
        points.push({ time: (new Date(txn.timestamp).getTime() / 1000) as Time, value: cash + hv });
      }
      // Add current point
      const curHv = Object.entries(tempHeld).reduce((s, [sym, sh]) => {
        const q = quoteMap[sym];
        return s + (sh > 0 ? sh * (q?.regularMarketPrice ?? 0) : 0);
      }, 0);
      points.push({ time: (Date.now() / 1000) as Time, value: balance + curHv });

      // Generate AI summary
      let aiSummary = '';
      const aiKey = localStorage.getItem('monn_ai_key');
      if (aiKey) {
        try {
          const provider = (localStorage.getItem('monn_ai_provider') as 'openai' | 'anthropic') || 'openai';
          const config: AIConfig = {
            apiKey: aiKey,
            apiUrl: localStorage.getItem('monn_ai_url') || 'https://api.openai.com/v1/chat/completions',
            model: localStorage.getItem('monn_ai_model') || 'gpt-4o-mini',
            provider,
          };
          const holdingsSummary = holdings.map((h) => {
            const q = quoteMap[h.symbol];
            const p = q?.regularMarketPrice ?? h.avgCost;
            const pnl = (p - h.avgCost) * h.shares;
            return `${h.symbol}: ${h.shares}股 成本${h.avgCost.toFixed(2)} 现价${p.toFixed(2)} 盈亏${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}`;
          }).join('\n');
          aiSummary = await callAI(config, [
            { role: 'user', content: `请用中文简要总结本次模拟投资（100字以内）：
投入${totalDeposited.toLocaleString()}，最终总资产${summary.totalAssets.toLocaleString()}，总盈亏${summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toLocaleString()}(${summary.totalPnlPct >= 0 ? '+' : ''}${summary.totalPnlPct.toFixed(2)}%)，股票市值${summary.stockValue.toLocaleString()}，现金${summary.cashBalance.toLocaleString()}。
持仓：${holdingsSummary || '无'}
交易次数：${transactions.length}
请总结得失教训和亮点。` },
          ], { maxTokens: 300, temperature: 0.5 });
        } catch { /* fall through */ }
      }
      if (!aiSummary) {
        aiSummary = `投入 ${totalDeposited.toLocaleString()}，最终总资产 ${summary.totalAssets.toLocaleString()}，总盈亏 ${summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl.toLocaleString()} (${summary.totalPnlPct >= 0 ? '+' : ''}${summary.totalPnlPct.toFixed(2)}%)。共 ${transactions.length} 笔交易，持仓 ${holdings.length} 只。`;
      }

      saveSession({
        name: `第${savedSessions.length + 1}期`,
        initialBalance: totalDeposited,
        finalBalance: summary.totalAssets,
        totalPnl: summary.totalPnl,
        totalPnlPct: summary.totalPnlPct,
        stockValue: summary.stockValue,
        cashBalance: summary.cashBalance,
        holdings: [...holdings],
        transactionCount: transactions.length,
        chartPoints: points,
        aiSummary,
      });
      setResetSaving(false);
    }
    resetPortfolio();
    resetOrders();
    setShowResetModal(false);
  };

  const handleTrade = () => {
    if (!tradeSymbol || tradeShares <= 0 || tradePrice <= 0) {
      setTradeMsg('请选择股票并输入有效数量'); return;
    }
    // Market hours check
    const market = canTrade(tradeSymbol);
    if (!market.ok) {
      setTradeMsg(`无法交易：${market.reason}`);
      return;
    }
    if (tradeType === 'buy') {
      if (tradeTotal > balance) { setTradeMsg('资金不足'); return; }
      const ok = buy(tradeSymbol, tradeShares, tradePrice);
      setTradeMsg(ok ? `买入成功：${tradeSymbol} ${tradeShares}股 @ ${tradePrice.toFixed(2)}` : '交易失败');
    } else {
      if (!holdingInfo || holdingInfo.shares < tradeShares) {
        setTradeMsg('持仓不足'); return;
      }
      const ok = sell(tradeSymbol, tradeShares, tradePrice);
      const pnl = tradePrice - (holdingInfo?.avgCost ?? 0);
      const pnlTotal = pnl * tradeShares;
      setTradeMsg(ok ? `卖出成功：${tradeSymbol} ${tradeShares}股 @ ${tradePrice.toFixed(2)} · 盈亏 ${pnlTotal >= 0 ? '+' : ''}${pnlTotal.toLocaleString()}` : '交易失败');
    }
    if (tradeMsgTimer.current) clearTimeout(tradeMsgTimer.current);
    tradeMsgTimer.current = setTimeout(() => setTradeMsg(''), 4000);
  };

  // Quick-fill helpers
  const maxBuyShares = tradePrice > 0 ? Math.floor(balance / tradePrice) : 0;
  const maxSellShares = holdingInfo?.shares ?? 0;
  const sellPnl = holdingInfo && tradePrice > 0 ? (tradePrice - holdingInfo.avgCost) * tradeShares : 0;
  const sellPnlPct = holdingInfo && holdingInfo.avgCost > 0 ? ((tradePrice - holdingInfo.avgCost) / holdingInfo.avgCost * 100) : 0;

  const getRecommendColor = (action: string) => {
    switch (action) {
      case 'buy': return 'var(--color-up)';
      case 'sell': return 'var(--color-down)';
      case 'reduce': return '#e67e22';
      default: return 'var(--color-warning)';
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">投资模拟</h1>
        <p className="page-desc">
          <span className="live-dot" />
          持仓 · 交易 · 实时盈亏 · AI分析 &nbsp;
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
            ({user.username})
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setShowResetModal(true)}>重置模拟</button>
            <button className="btn btn-sm" style={{ marginLeft: 4 }} onClick={logout}>退出</button>
          </span>
        </p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        {/* Portfolio Summary */}
        <div className="dashboard-grid fixed-4col mb-4">
          {[
            { label: '总资产', value: summary.totalAssets.toLocaleString(), sub: `投入 ${totalDeposited.toLocaleString()}`, color: 'var(--text-primary)' },
            { label: '股票市值', value: summary.stockValue.toLocaleString(), sub: `${summary.positionCount} 只持仓`, color: 'var(--color-accent)' },
            { label: '可用现金', value: summary.cashBalance.toLocaleString(), sub: `${summary.totalAssets > 0 ? ((summary.cashBalance / summary.totalAssets) * 100).toFixed(0) : 0}% 仓位`, color: 'var(--text-secondary)' },
            { label: '总盈亏', value: (summary.totalPnl >= 0 ? '+' : '') + summary.totalPnl.toLocaleString(), sub: `${summary.totalPnlPct >= 0 ? '+' : ''}${summary.totalPnlPct.toFixed(2)}%`, color: summary.totalPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)' },
          ].map((card) => (
            <div key={card.label} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Fund Management */}
        <FundManager balance={balance} deposit={deposit} withdraw={withdraw} />

        {/* Portfolio Value Chart */}
        <PortfolioChart
          transactions={transactions}
          holdings={holdings}
          currentBalance={balance}
          totalDeposited={totalDeposited}
          quoteMap={quoteMap}
        />

        {/* Conditional Orders */}
        <ConditionalOrderPanel
          orders={orders}
          pendingOrders={pendingOrders}
          holdings={holdings}
          quoteMap={quoteMap}
          onAdd={addOrder}
          onCancel={cancelOrder}
        />

        {/* Trade Panel */}
        <div className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="card-title" style={{ marginBottom: 0 }}>交易下单</span>
              {tradeSymbol && tradeQuote && (
                <>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>|</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-accent)' }}>{tradeSymbol}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {tradeQuote.shortName ?? tradeQuote.longName ?? ''}
                  </span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {tradeMarket && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: tradeMarket.ok ? 'var(--color-up-bg)' : 'var(--color-down-bg)',
                  color: tradeMarket.ok ? 'var(--color-up)' : 'var(--color-down)',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: tradeMarket.ok ? '#26a69a' : '#ef5350',
                    animation: tradeMarket.ok ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  }} />
                  {tradeMarket.market} · {tradeMarket.ok ? '可交易' : tradeMarket.reason}
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 18, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Left: Symbol Search + Quick Select */}
            <div style={{ flex: '0 0 240px' }}>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>股票代码</label>
                <input
                  className="input"
                  value={symbolSearch}
                  onChange={(e) => { setSymbolSearch(e.target.value); setShowSymbolList(true); }}
                  onFocus={() => setShowSymbolList(true)}
                  onBlur={() => setTimeout(() => setShowSymbolList(false), 200)}
                  placeholder="搜索代码或名称..."
                  style={{ width: '100%', fontSize: 14, fontFamily: 'var(--font-mono)' }}
                />
                {showSymbolList && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, width: 280,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                    borderRadius: 6, zIndex: 50, maxHeight: 280, overflow: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    {filteredSymbols.map((s) => {
                      const q = quoteMap[s];
                      const chg = q?.regularMarketChangePercent ?? 0;
                      return (
                        <div key={s}
                          onMouseDown={() => { setTradeSymbol(s); setSymbolSearch(s); setShowSymbolList(false); }}
                          style={{
                            padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                          className="sidebar-item"
                        >
                          <div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>{s}</span>
                            <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 11 }}>
                              {(q?.shortName ?? '').slice(0, 14)}
                            </span>
                          </div>
                          {q && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: chg >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                              {q.regularMarketPrice?.toFixed(2)} {chg >= 0 ? '+' : ''}{chg.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick holding select */}
              {holdings.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>快捷选择持仓</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {holdings.map((h) => (
                      <button
                        key={h.symbol}
                        className={`btn btn-sm ${tradeSymbol === h.symbol ? 'btn-primary' : ''}`}
                        onClick={() => { setTradeSymbol(h.symbol); setSymbolSearch(h.symbol); }}
                        style={{ fontSize: 11, padding: '3px 8px', fontFamily: 'var(--font-mono)' }}
                      >
                        {h.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Center: Price Display */}
            {tradeSymbol && tradePrice > 0 ? (
              <div style={{
                flex: '0 0 auto', textAlign: 'center',
                padding: '8px 20px', borderRadius: 8,
                background: 'var(--bg-tertiary)', minWidth: 140,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#26a69a',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>实时报价</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                  {tradePrice.toFixed(2)}
                </div>
                {tradeQuote && (
                  <div style={{
                    fontSize: 13, fontWeight: 600, marginTop: 2,
                    color: (tradeQuote.regularMarketChangePercent ?? 0) >= 0 ? 'var(--color-up)' : 'var(--color-down)',
                  }}>
                    {(tradeQuote.regularMarketChangePercent ?? 0) >= 0 ? '+' : ''}{tradeQuote.regularMarketChangePercent?.toFixed(2)}%
                  </div>
                )}
              </div>
            ) : tradeSymbol ? (
              <div style={{ flex: '0 0 auto', padding: '8px 20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                加载报价中...
              </div>
            ) : (
              <div style={{ flex: '0 0 auto', padding: '8px 20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                请选择股票代码
              </div>
            )}

            {/* Market data mini-card */}
            {tradeQuote && (
              <div style={{ flex: '0 0 auto', display: 'flex', gap: 16, fontSize: 11 }}>
                {[
                  { label: '今开', value: tradeQuote.regularMarketOpen?.toFixed(2) ?? '--' },
                  { label: '最高', value: tradeQuote.regularMarketDayHigh?.toFixed(2) ?? '--', color: 'var(--color-up)' },
                  { label: '最低', value: tradeQuote.regularMarketDayLow?.toFixed(2) ?? '--', color: 'var(--color-down)' },
                  { label: '成交量', value: tradeQuote.regularMarketVolume ? ((tradeQuote.regularMarketVolume / 10000).toFixed(0) + '万') : '--' },
                ].map((d) => (
                  <div key={d.label} style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>{d.label}</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: (d as any).color ?? 'var(--text-primary)' }}>
                      {d.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trade Controls Row */}
          <div style={{
            padding: '14px 18px', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap',
            background: 'var(--bg-tertiary)',
          }}>
            {/* Direction */}
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>方向</label>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  className={`btn btn-sm ${tradeType === 'buy' ? 'btn-primary' : ''}`}
                  onClick={() => setTradeType('buy')}
                  style={{ fontWeight: 600, minWidth: 56 }}
                >
                  买入
                </button>
                <button
                  className={`btn btn-sm ${tradeType === 'sell' ? 'btn-primary' : ''}`}
                  onClick={() => setTradeType('sell')}
                  style={{ fontWeight: 600, minWidth: 56 }}
                  disabled={!holdingInfo}
                >
                  卖出
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>数量(股)</label>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  className="input" type="number" value={tradeShares} min={1} step={100}
                  onChange={(e) => setTradeShares(Math.max(1, parseInt(e.target.value) || 0))}
                  style={{ width: 100, fontSize: 14, fontFamily: 'var(--font-mono)' }}
                />
                {[100, 500, 1000, 5000].map((n) => (
                  <button
                    key={n}
                    className={`btn btn-sm ${tradeShares === n ? 'btn-primary' : ''}`}
                    onClick={() => setTradeShares(n)}
                    style={{ fontSize: 10, padding: '4px 7px', minWidth: 0 }}
                  >
                    {n >= 1000 ? (n / 1000) + 'K' : n}
                  </button>
                ))}
                {tradeType === 'buy' && maxBuyShares > 0 && (
                  <button className="btn btn-sm" onClick={() => setTradeShares(maxBuyShares)}
                    style={{ fontSize: 10, padding: '4px 8px' }} title={`最多 ${maxBuyShares} 股`}>
                    满仓
                  </button>
                )}
                {tradeType === 'sell' && maxSellShares > 0 && (
                  <button className="btn btn-sm" onClick={() => setTradeShares(maxSellShares)}
                    style={{ fontSize: 10, padding: '4px 8px', color: 'var(--color-down)' }}>
                    清仓
                  </button>
                )}
              </div>
            </div>

            {/* Price confirm */}
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>成交价</label>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {tradePrice > 0 ? tradePrice.toFixed(2) : '--'}
              </div>
            </div>

            {/* Total & P&L preview */}
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                {tradeType === 'buy' ? '应付金额' : '应收金额'}
              </label>
              <div style={{
                fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: tradeType === 'buy' ? 'var(--color-down)' : 'var(--color-up)',
              }}>
                {tradePrice > 0 ? (tradeType === 'buy' ? '-' : '+') + tradeTotal.toLocaleString() : '--'}
              </div>
            </div>

            {/* Sell P&L preview */}
            {tradeType === 'sell' && holdingInfo && tradePrice > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>预估盈亏</label>
                <div style={{
                  fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: sellPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)',
                }}>
                  {sellPnl >= 0 ? '+' : ''}{sellPnl.toLocaleString()}
                  <span style={{ fontSize: 12, marginLeft: 4 }}>
                    ({sellPnlPct >= 0 ? '+' : ''}{sellPnlPct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            )}

            {/* Available balance / holding info */}
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                {tradeType === 'buy' ? '可用资金' : '持仓数量'}
              </label>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {tradeType === 'buy'
                  ? balance.toLocaleString()
                  : holdingInfo ? `${holdingInfo.shares.toLocaleString()} 股 @ ${holdingInfo.avgCost.toFixed(2)}` : '无持仓'
                }
              </div>
            </div>

            {/* Trade button */}
            <button
              className="btn btn-primary"
              style={{ height: 40, fontSize: 15, fontWeight: 700, padding: '0 32px', minWidth: 100 }}
              onClick={handleTrade}
              disabled={!tradeSymbol || tradePrice <= 0}
            >
              {tradeType === 'buy' ? '确认买入' : '确认卖出'}
            </button>
          </div>

          {/* Message */}
          {tradeMsg && (
            <div style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              color: tradeMsg.includes('成功') ? 'var(--color-up)' : 'var(--color-down)',
              background: tradeMsg.includes('成功') ? 'var(--color-up-bg)' : 'var(--color-down-bg)',
              borderTop: '1px solid var(--border-subtle)',
            }}>
              {tradeMsg}
            </div>
          )}
        </div>

        {holdings.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>暂无持仓</div>
            <div style={{ fontSize: 13 }}>使用上方交易面板开始你的第一笔模拟交易</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>初始资金: {balance.toLocaleString()} 可用</div>
          </div>
        ) : (
          <>
            {/* Holdings Table */}
            <div className="card mb-4">
              <div className="card-title mb-3">持仓明细</div>
              <div style={{ overflow: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>代码</th><th>持仓(股)</th><th>成本价</th><th>现价</th>
                      <th>市值</th><th>盈亏</th><th>盈亏%</th><th>占比</th><th>建议</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyses.map((a) => (
                      <tr key={a.symbol}>
                        <td style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{a.symbol}</td>
                        <td>{a.shares.toLocaleString()}</td>
                        <td className="font-mono">{a.avgCost.toFixed(2)}</td>
                        <td className="font-mono">{a.currentPrice.toFixed(2)}</td>
                        <td className="font-mono">{a.marketValue.toLocaleString()}</td>
                        <td className={`font-mono ${a.pnl >= 0 ? 'color-up' : 'color-down'}`}>
                          {a.pnl >= 0 ? '+' : ''}{a.pnl.toLocaleString()}
                        </td>
                        <td className={`font-mono ${a.pnlPct >= 0 ? 'color-up' : 'color-down'}`}
                          style={{ fontWeight: 600 }}>
                          {a.pnlPct >= 0 ? '+' : ''}{a.pnlPct.toFixed(2)}%
                        </td>
                        <td>{a.weightPct.toFixed(1)}%</td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: getRecommendColor(a.recommendation.action) + '22',
                            color: getRecommendColor(a.recommendation.action),
                          }}>
                            {a.recommendation.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-Stock Analysis */}
            <div className="card mb-4">
              <div className="card-title mb-3">逐股分析建议</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {analyses.map((a) => (
                  <div key={a.symbol} style={{
                    padding: 14, borderRadius: 8,
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{a.symbol}</span>
                        <span className={`font-mono ${a.pnlPct >= 0 ? 'color-up' : 'color-down'}`}
                          style={{ fontSize: 13, fontWeight: 600 }}>
                          {a.pnlPct >= 0 ? '+' : ''}{a.pnlPct.toFixed(2)}%
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          成本 {a.avgCost.toFixed(2)} · 现价 {a.currentPrice.toFixed(2)} · 仓位 {a.weightPct.toFixed(1)}%
                        </span>
                      </div>
                      <span style={{
                        padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        background: getRecommendColor(a.recommendation.action) + '22',
                        color: getRecommendColor(a.recommendation.action),
                        border: `1px solid ${getRecommendColor(a.recommendation.action)}44`,
                      }}>
                        {a.recommendation.label} (置信度 {a.recommendation.confidence}%)
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {a.recommendation.reasons.map((r, i) => (
                        <span key={i} style={{
                          padding: '2px 8px', fontSize: 11, borderRadius: 3,
                          background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                        }}>
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Deep Analysis */}
            <AIAnalysis analyses={analyses} balance={balance} />
          </>
        )}

        {/* Session History */}
        {savedSessions.length > 0 && (
          <SessionHistoryPanel sessions={savedSessions} onDelete={(id) => useSessionHistoryStore.getState().deleteSession(id)} />
        )}

        {/* Transaction History */}
        {transactions.length > 0 && (
          <div className="card">
            <div className="card-title mb-3">交易记录 ({transactions.length})</div>
            <div style={{ overflow: 'auto', maxHeight: 300 }}>
              <table className="data-table">
                <thead>
                  <tr><th>时间</th><th>代码</th><th>方向</th><th>数量</th><th>价格</th><th>金额</th></tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 50).map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {new Date(t.timestamp).toLocaleString('zh-CN')}
                      </td>
                      <td style={{ fontWeight: 600, color: t.type === 'deposit' || t.type === 'withdraw' ? 'var(--text-tertiary)' : 'var(--color-accent)' }}>
                        {t.type === 'deposit' ? '入金' : t.type === 'withdraw' ? '出金' : t.symbol}
                      </td>
                      <td className={
                        t.type === 'buy' ? 'color-up' :
                        t.type === 'sell' ? 'color-down' :
                        t.type === 'deposit' ? 'color-up' : 'color-down'
                      }>
                        {t.type === 'buy' ? '买入' : t.type === 'sell' ? '卖出' : t.type === 'deposit' ? '入金' : '出金'}
                      </td>
                      <td className="font-mono">{t.type === 'buy' || t.type === 'sell' ? t.shares.toLocaleString() : '---'}</td>
                      <td className="font-mono">{t.type === 'buy' || t.type === 'sell' ? t.price.toFixed(2) : '---'}</td>
                      <td className={`font-mono ${t.type === 'buy' || t.type === 'withdraw' ? 'color-down' : 'color-up'}`}>
                        {t.type === 'buy' || t.type === 'withdraw' ? '-' : '+'}{t.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reset Modal */}
        {showResetModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setShowResetModal(false)}>
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 12, padding: 28, width: 420,
              border: '1px solid var(--border-primary)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>重置模拟交易</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                当前持仓将被清空，资金恢复至初始状态。
                <br />是否保存本次模拟记录？
                {holdings.length > 0 && (
                  <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 6, fontSize: 12 }}>
                    <div>投入: {totalDeposited.toLocaleString()} · 总资产: {summary.totalAssets.toLocaleString()}</div>
                    <div style={{ fontWeight: 600, color: summary.totalPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                      盈亏: {summary.totalPnl >= 0 ? '+' : ''}{summary.totalPnl.toLocaleString()} ({summary.totalPnlPct >= 0 ? '+' : ''}{summary.totalPnlPct.toFixed(2)}%)
                    </div>
                    <div style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
                      持仓 {holdings.length} 只 · 交易 {transactions.length} 笔
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setShowResetModal(false)}>取消</button>
                <button className="btn" onClick={() => handleReset(false)} style={{ color: 'var(--color-down)' }}>
                  不保存，直接重置
                </button>
                <button className="btn btn-primary" onClick={() => handleReset(true)} disabled={resetSaving}>
                  {resetSaving ? 'AI 总结中...' : '保存并重置'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- AI Analysis Sub-component ----
function AIAnalysis({ analyses, balance }: {
  analyses: ReturnType<typeof analyzePortfolio>;
  balance: number;
}) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('monn_ai_key') || '');
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('monn_ai_url') || 'https://api.openai.com/v1/chat/completions');
  const [model, setModel] = useState(() => localStorage.getItem('monn_ai_model') || 'gpt-4o-mini');
  const [provider, setProvider] = useState<'openai' | 'anthropic'>(
    () => (localStorage.getItem('monn_ai_provider') as 'openai' | 'anthropic') || 'openai'
  );
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(!apiKey);

  const buildPrompt = () => {
    if (analyses.length === 0) return '';
    const lines = analyses.map((a) =>
      `${a.symbol}: 持仓${a.shares}股, 成本${a.avgCost.toFixed(2)}, 现价${a.currentPrice.toFixed(2)}, 盈亏${a.pnlPct >= 0 ? '+' : ''}${a.pnlPct.toFixed(1)}%, 仓位占比${a.weightPct.toFixed(1)}%`
    );
    return `你是一位专业的投资顾问。请分析以下模拟持仓组合并给出建议：

资金情况：可用现金 ${balance.toLocaleString()}

当前持仓：
${lines.join('\n')}

请从以下角度分析：
1. 组合整体风险评估（集中度、行业分布）
2. 每只股票的诊断（盈利/亏损原因分析）
3. 调仓建议（哪些该加仓、减仓、清仓，给出具体理由）
4. 未来关注要点

请用中文回答，语言简洁直接，避免套话。`;
  };

  const runAI = async () => {
    if (!apiKey) { setShowConfig(true); return; }
    const prompt = buildPrompt();
    if (!prompt) return;

    setLoading(true);
    setResult('');
    try {
      const aiConfig: AIConfig = { apiKey, apiUrl, model, provider };
      const reply = await callAI(aiConfig, [{ role: 'user', content: prompt }], { maxTokens: 1500, temperature: 0.5 });
      setResult(reply);
    } catch (e: any) {
      setResult(`请求失败：${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = () => {
    localStorage.setItem('monn_ai_key', apiKey);
    localStorage.setItem('monn_ai_url', apiUrl);
    localStorage.setItem('monn_ai_model', model);
    localStorage.setItem('monn_ai_provider', provider);
    setShowConfig(false);
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

  return (
    <div className="card mb-4" style={{ borderLeft: '3px solid var(--color-accent)' }}>
      <div className="card-title mb-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>AI 深度分析</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setShowConfig(!showConfig)}>
            {showConfig ? '收起配置' : 'API 配置'}
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={runAI}
            disabled={loading}
          >
            {loading ? 'AI 分析中...' : result ? '重新分析' : '开始 AI 分析'}
          </button>
        </div>
      </div>

      {showConfig && (
        <div style={{
          padding: 12, marginBottom: 12, borderRadius: 6,
          background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            支持 OpenAI / Anthropic 及其他兼容接口
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>服务商</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {([
                ['openai', 'OpenAI/兼容'],
                ['anthropic', 'Anthropic'],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  className={`btn btn-sm ${provider === k ? 'btn-primary' : ''}`}
                  onClick={() => handleProviderChange(k)}
                  style={{ fontSize: 11 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>API URL</label>
              <input className="input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                placeholder={provider === 'anthropic' ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions'} style={{ width: 340, fontSize: 12 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>模型</label>
              <input className="input" value={model} onChange={(e) => setModel(e.target.value)}
                placeholder={provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini'} style={{ width: 160, fontSize: 12 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>API Key</label>
              <input className="input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'} style={{ width: 200, fontSize: 12 }} />
            </div>
            <button className="btn btn-sm" onClick={saveConfig}>保存</button>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
          正在调用 AI 模型分析持仓数据...
        </div>
      )}

      {result && (
        <div style={{
          whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8,
          color: 'var(--text-primary)', padding: '8px 0',
        }}>
          {result}
        </div>
      )}

      {!result && !loading && (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
          点击"开始 AI 分析"，AI 将读取你的持仓数据并给出专业投资建议
        </div>
      )}
    </div>
  );
}

// ---- Fund Manager ----
function FundManager({ balance, deposit, withdraw }: {
  balance: number; deposit: (n: number) => void; withdraw: (n: number) => boolean;
}) {
  const [amount, setAmount] = useState(100_000);
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [msg, setMsg] = useState('');

  const handleSubmit = () => {
    if (amount <= 0) { setMsg('请输入有效金额'); return; }
    if (mode === 'deposit') {
      deposit(amount);
      setMsg(`入金成功 +${amount.toLocaleString()}`);
    } else {
      const ok = withdraw(amount);
      setMsg(ok ? `出金成功 -${amount.toLocaleString()}` : '出金失败：余额不足');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="card mb-4" style={{ padding: 16 }}>
      <div className="card-title mb-3">资金管理</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>操作</label>
          <div style={{ display: 'flex', gap: 2 }}>
            <button className={`btn btn-sm ${mode === 'deposit' ? 'btn-primary' : ''}`}
              onClick={() => setMode('deposit')}>入金</button>
            <button className={`btn btn-sm ${mode === 'withdraw' ? 'btn-primary' : ''}`}
              onClick={() => setMode('withdraw')}>出金</button>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>金额</label>
          <input className="input" type="number" value={amount} min={1} step={10000}
            onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
            style={{ width: 140, fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>当前余额</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{balance.toLocaleString()}</div>
        </div>
        <button className="btn btn-primary" style={{ height: 36 }} onClick={handleSubmit}>
          {mode === 'deposit' ? '确认入金' : '确认出金'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {[10_000, 50_000, 100_000, 500_000, 1_000_000].map((n) => (
            <button key={n} className="btn btn-sm" onClick={() => setAmount(n)}
              style={{ fontSize: 11 }}>{(n / 10000).toFixed(0)}万</button>
          ))}
        </div>
      </div>
      {msg && (
        <div style={{
          marginTop: 10, fontSize: 12,
          color: msg.includes('成功') ? 'var(--color-up)' : 'var(--color-down)',
          padding: '6px 10px',
          background: msg.includes('成功') ? 'var(--color-up-bg)' : 'var(--color-down-bg)',
          borderRadius: 4,
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}

// ---- Portfolio Value Chart ----
function PortfolioChart({ transactions, holdings: _holdings, currentBalance, totalDeposited, quoteMap }: {
  transactions: Transaction[];
  holdings: Holding[];
  currentBalance: number;
  totalDeposited: number;
  quoteMap: Record<string, any>;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstRef = useRef<{ chart: any; lineSeries: any; areaSeries: any } | null>(null);

  const data = useMemo(() => {
    if (transactions.length === 0) return { points: [] as LineData[], initial: 0, current: 0, growthPct: 0 };

    // Walk transactions chronological order (oldest first)
    const sorted = [...transactions].reverse();
    const points: LineData[] = [];

    // Start from totalDeposited, walk forward
    let cash = totalDeposited;
    const tempHeld: Record<string, number> = {};

    for (const txn of sorted) {
      if (txn.type === 'buy') {
        cash -= txn.total;
        tempHeld[txn.symbol] = (tempHeld[txn.symbol] || 0) + txn.shares;
      } else if (txn.type === 'sell') {
        cash += txn.total;
        tempHeld[txn.symbol] = (tempHeld[txn.symbol] || 0) - txn.shares;
      } else if (txn.type === 'deposit') {
        cash += txn.total;
      } else if (txn.type === 'withdraw') {
        cash -= txn.total;
      }

      const heldValue = Object.entries(tempHeld).reduce((sum, [sym, sh]) => {
        const q = quoteMap[sym];
        const price = q?.regularMarketPrice ?? 0;
        return sum + (sh > 0 ? sh * price : 0);
      }, 0);

      points.push({ time: (new Date(txn.timestamp).getTime() / 1000) as Time, value: cash + heldValue });
    }

    // Add current point using latest balance + holding values
    const curStockVal = Object.entries(tempHeld).reduce((sum, [sym, sh]) => {
      const q = quoteMap[sym];
      return sum + (sh > 0 ? sh * (q?.regularMarketPrice ?? 0) : 0);
    }, 0);
    points.push({ time: (Date.now() / 1000) as Time, value: currentBalance + curStockVal });

    const initial = points[0]?.value ?? 0;
    const current = points[points.length - 1]?.value ?? 0;
    const growthPct = initial > 0 ? ((current - initial) / initial) * 100 : 0;

    return { points, initial, current, growthPct };
  }, [transactions, totalDeposited, currentBalance, quoteMap]);

  // Create chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888',
      },
      grid: {
        vertLines: { color: '#1a1a2e' },
        horzLines: { color: '#1a1a2e' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 260,
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    });

    const lineSeries = chart.addLineSeries({ color: '#4fc3f7', lineWidth: 2 });
    const areaSeries = chart.addAreaSeries({
      topColor: 'rgba(79, 195, 247, 0.2)',
      bottomColor: 'rgba(79, 195, 247, 0.02)',
      lineColor: 'transparent',
    });

    chartInstRef.current = { chart, lineSeries, areaSeries };

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update data without recreating chart
  useEffect(() => {
    const inst = chartInstRef.current;
    if (!inst || data.points.length === 0) return;
    inst.lineSeries.setData(data.points);
    inst.areaSeries.setData(data.points);
    inst.chart.timeScale().fitContent();
  }, [data.points]);

  const formatValue = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(v) >= 10_000) return (v / 10_000).toFixed(1) + '万';
    return v.toLocaleString();
  };

  if (data.points.length === 0) {
    return (
      <div className="card mb-4" style={{ padding: 16 }}>
        <div className="card-title mb-3">资产走势</div>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
          暂无交易数据，开始交易后将展示资产变化曲线
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-4" style={{ padding: 16 }}>
      <div className="card-title mb-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>资产走势</span>
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>
            初始: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatValue(data.initial)}</span>
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            当前: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatValue(data.current)}</span>
          </span>
          <span style={{
            fontWeight: 600,
            color: data.growthPct >= 0 ? 'var(--color-up)' : 'var(--color-down)',
          }}>
            {data.growthPct >= 0 ? '+' : ''}{data.growthPct.toFixed(2)}%
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} style={{ width: '100%', height: 260 }} />
    </div>
  );
}

// ---- Conditional Order Panel ----
function ConditionalOrderPanel({ orders, pendingOrders, holdings, quoteMap, onAdd, onCancel }: {
  orders: ConditionalOrder[];
  pendingOrders: ConditionalOrder[];
  holdings: Holding[];
  quoteMap: Record<string, any>;
  onAdd: (order: Omit<ConditionalOrder, 'id' | 'createdAt' | 'status'>) => void;
  onCancel: (id: string) => void;
}) {
  const [sym, setSym] = useState('');
  const [symSearch, setSymSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [shares, setShares] = useState(100);
  const [triggerType, setTriggerType] = useState<TriggerType>('price_le');
  const [triggerPrice, setTriggerPrice] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [msg, setMsg] = useState('');

  const filteredSearch = useMemo(() => {
    if (!symSearch.trim()) return ALL_STOCKS.slice(0, 15);
    return ALL_STOCKS.filter((s) => s.toUpperCase().includes(symSearch.toUpperCase())).slice(0, 15);
  }, [symSearch]);

  const triggerLabels: Record<TriggerType, string> = {
    market_open: '开盘时',
    price_le: '价格 ≤',
    price_ge: '价格 ≥',
  };

  const handleAdd = () => {
    if (!sym.trim()) { setMsg('请选择股票代码'); return; }
    if (triggerType !== 'market_open' && triggerPrice <= 0) { setMsg('请输入触发价格'); return; }
    if (shares <= 0) { setMsg('请输入有效数量'); return; }
    onAdd({
      symbol: sym.trim().toUpperCase(),
      type,
      shares,
      triggerType,
      triggerPrice: triggerType === 'market_open' ? 0 : triggerPrice,
    });
    setMsg(`已添加：${sym} ${type === 'buy' ? '买入' : '卖出'} ${shares}股 ${triggerType === 'market_open' ? '开盘时' : (triggerType === 'price_le' ? '≤' : '≥') + triggerPrice.toFixed(2)}`);
    setSym('');
    setSymSearch('');
    setShares(100);
    setTriggerPrice(0);
    setShowForm(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleCancel = (id: string) => {
    onCancel(id);
    setMsg('已撤销条件单');
    setTimeout(() => setMsg(''), 2000);
  };

  const historyOrders = orders.filter((o) => o.status !== 'pending');
  const q = quoteMap[sym];
  const currentPrice = q?.regularMarketPrice ?? 0;

  return (
    <div className="card mb-4" style={{ padding: 16 }}>
      <div className="card-title mb-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>条件单 / 预埋单</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {pendingOrders.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 600 }}>
              {pendingOrders.length} 条待触发
            </span>
          )}
          {historyOrders.length > 0 && (
            <button className="btn btn-sm" onClick={() => setShowHistory(!showHistory)} style={{ fontSize: 11 }}>
              {showHistory ? '收起' : '历史'} ({historyOrders.length})
            </button>
          )}
          <button className="btn btn-sm btn-primary" onClick={() => setShowForm(!showForm)} style={{ fontSize: 11 }}>
            {showForm ? '收起' : '+ 新建'}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div style={{
          padding: 14, marginBottom: 14, borderRadius: 8,
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
          display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>股票代码</label>
            <input className="input" value={symSearch}
              onChange={(e) => { setSymSearch(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="搜索代码..."
              style={{ width: 150, fontSize: 13, fontFamily: 'var(--font-mono)' }}
            />
            {showSearch && symSearch && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, width: 260, zIndex: 60,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                borderRadius: 6, maxHeight: 240, overflow: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                {filteredSearch.map((s) => {
                  const q = quoteMap[s];
                  return (
                    <div key={s}
                      onMouseDown={() => { setSym(s); setSymSearch(s); setShowSearch(false); }}
                      style={{
                        padding: '7px 10px', cursor: 'pointer', fontSize: 12,
                        display: 'flex', justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                      className="sidebar-item"
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>{s}</span>
                      {q && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: (q.regularMarketChangePercent ?? 0) >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                          {q.regularMarketPrice?.toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })}
                {filteredSearch.length === 0 && (
                  <div style={{ padding: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>未找到匹配股票</div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 4, maxWidth: 240 }}>
              {holdings.slice(0, 8).map((h) => (
                <button key={h.symbol} className="btn btn-sm" onClick={() => { setSym(h.symbol); setSymSearch(h.symbol); }}
                  style={{ fontSize: 9, padding: '1px 5px' }}>{h.symbol}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>方向</label>
            <div style={{ display: 'flex', gap: 2 }}>
              <button className={`btn btn-sm ${type === 'buy' ? 'btn-primary' : ''}`}
                onClick={() => setType('buy')}>买入</button>
              <button className={`btn btn-sm ${type === 'sell' ? 'btn-primary' : ''}`}
                onClick={() => setType('sell')}>卖出</button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>数量(股)</label>
            <input className="input" type="number" value={shares} min={1} step={100}
              onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 0))}
              style={{ width: 90, fontSize: 13 }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>触发条件</label>
            <select className="input" value={triggerType} onChange={(e) => setTriggerType(e.target.value as TriggerType)}
              style={{ fontSize: 12, padding: '4px 8px', width: 120 }}>
              <option value="market_open">开盘时</option>
              <option value="price_le">价格 ≤</option>
              <option value="price_ge">价格 ≥</option>
            </select>
          </div>

          {triggerType !== 'market_open' && (
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>触发价</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="input" type="number" value={triggerPrice || ''} step={0.01}
                  onChange={(e) => setTriggerPrice(parseFloat(e.target.value) || 0)}
                  style={{ width: 90, fontSize: 13 }} />
                {sym && currentPrice > 0 && (
                  <button className="btn btn-sm" onClick={() => setTriggerPrice(currentPrice)}
                    style={{ fontSize: 10, padding: '2px 6px' }} title="填充当前价">
                    现价
                  </button>
                )}
              </div>
              {sym && currentPrice > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  当前 {currentPrice.toFixed(2)}
                  {triggerPrice > 0 && (
                    <span style={{
                      marginLeft: 6,
                      color: triggerType === 'price_le'
                        ? (currentPrice <= triggerPrice ? 'var(--color-up)' : 'var(--text-secondary)')
                        : (currentPrice >= triggerPrice ? 'var(--color-up)' : 'var(--text-secondary)'),
                    }}>
                      {currentPrice <= triggerPrice && triggerType === 'price_le' ? '✓ 已触发' :
                       currentPrice >= triggerPrice && triggerType === 'price_ge' ? '✓ 已触发' :
                       `距触发 ${(triggerType === 'price_le' ? currentPrice - triggerPrice : triggerPrice - currentPrice).toFixed(2)}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <button className="btn btn-primary" onClick={handleAdd} style={{ height: 36 }}>
              添加条件单
            </button>
            {msg && (
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: msg.includes('已添加') || msg.includes('已撤销') ? 'var(--color-up)' : 'var(--color-down)',
              }}>
                {msg}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Feedback outside form */}
      {msg && !showForm && (
        <div style={{
          padding: '6px 12px', marginBottom: 10, fontSize: 12, fontWeight: 600, borderRadius: 4,
          color: msg.includes('已添加') || msg.includes('已撤销') ? 'var(--color-up)' : 'var(--color-down)',
          background: msg.includes('已添加') || msg.includes('已撤销') ? 'var(--color-up-bg)' : 'var(--color-down-bg)',
        }}>
          {msg}
        </div>
      )}

      {/* Empty state */}
      {!showForm && pendingOrders.length === 0 && !showHistory && (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
          暂无条件单。点击"+ 新建"设置开盘自动买入、价格触发单、止损止盈等
        </div>
      )}

      {/* Pending orders list */}
      {pendingOrders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pendingOrders.map((o) => {
            const q = quoteMap[o.symbol];
            const price = q?.regularMarketPrice;
            const marketOpen = canTrade(o.symbol).ok;
            const priceConditionMet = o.triggerType === 'market_open'
              ? true
              : o.triggerType === 'price_le'
                ? price != null && price <= o.triggerPrice
                : price != null && price >= o.triggerPrice;
            const readyToExecute = marketOpen && priceConditionMet && (o.triggerType !== 'market_open' || Date.now() - new Date(o.createdAt).getTime() > 120_000);

            let statusLabel = '';
            let statusColor = '';
            if (!marketOpen) {
              statusLabel = '休市中，等待开盘';
              statusColor = 'var(--text-tertiary)';
            } else if (priceConditionMet) {
              statusLabel = '● 条件满足，即将执行';
              statusColor = 'var(--color-up)';
            } else {
              statusLabel = price != null
                ? `距触发 ${(o.triggerType === 'price_le' ? price - o.triggerPrice : o.triggerPrice - price).toFixed(2)}`
                : '等待报价...';
              statusColor = 'var(--text-secondary)';
            }

            return (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 6,
                background: readyToExecute ? 'var(--color-up-bg)' : 'var(--bg-tertiary)',
                border: `1px solid ${readyToExecute ? 'var(--color-up)' : 'var(--border-subtle)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-accent)', fontSize: 14 }}>
                    {o.symbol}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 600,
                    background: o.type === 'buy' ? 'var(--color-up-bg)' : 'var(--color-down-bg)',
                    color: o.type === 'buy' ? 'var(--color-up)' : 'var(--color-down)',
                  }}>
                    {o.type === 'buy' ? '买入' : '卖出'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {o.shares.toLocaleString()} 股
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 500 }}>
                    {o.triggerType === 'market_open' ? '开盘时' :
                     o.triggerType === 'price_le' ? `价格 ≤ ${o.triggerPrice.toFixed(2)}` :
                     `价格 ≥ ${o.triggerPrice.toFixed(2)}`}
                  </span>
                  {price != null && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      现价 {price.toFixed(2)}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>
                    {statusLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {new Date(o.createdAt).toLocaleString('zh-CN')}
                  </span>
                  <button className="btn btn-sm" onClick={() => handleCancel(o.id)}
                    style={{ fontSize: 10, color: 'var(--color-down)', padding: '2px 8px' }}>
                    撤销
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      {showHistory && historyOrders.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>历史记录</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {historyOrders.map((o) => (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px',
                fontSize: 12, borderRadius: 4,
                background: 'var(--bg-tertiary)', opacity: 0.7,
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>
                  {o.symbol}
                </span>
                <span style={{
                  color: o.type === 'buy' ? 'var(--color-up)' : 'var(--color-down)', fontWeight: 600,
                }}>
                  {o.type === 'buy' ? '买入' : '卖出'}
                </span>
                <span>{o.shares}股</span>
                <span style={{ color: 'var(--text-tertiary)' }}>
                  {o.triggerType === 'market_open' ? '开盘' :
                   o.triggerType === 'price_le' ? `≤${o.triggerPrice}` : `≥${o.triggerPrice}`}
                </span>
                <span style={{
                  fontWeight: 600,
                  color: o.status === 'executed' ? 'var(--color-up)' : 'var(--text-tertiary)',
                }}>
                  {o.status === 'executed'
                    ? `已执行 @ ${o.executedPrice?.toFixed(2)}`
                    : '已撤销'}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 10, marginLeft: 'auto' }}>
                  {o.executedAt
                    ? new Date(o.executedAt).toLocaleString('zh-CN')
                    : new Date(o.createdAt).toLocaleString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Session History Panel ----
function SessionHistoryPanel({ sessions, onDelete }: {
  sessions: SavedSession[];
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chartInstances, setChartInstances] = useState<Record<string, any>>({});

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const chartRefCallback = (id: string, el: HTMLDivElement | null) => {
    if (!el || expandedId !== id) return;
    const session = sessions.find((s) => s.id === id);
    if (!session || session.chartPoints.length === 0) return;

    if (chartInstances[id]) chartInstances[id].remove();

    import('lightweight-charts').then(({ createChart, ColorType }) => {
      const chart = createChart(el, {
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#888' },
        grid: { vertLines: { color: '#1a1a2e' }, horzLines: { color: '#1a1a2e' } },
        width: el.clientWidth,
        height: 200,
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: false },
        crosshair: { mode: 0 },
      });
      const ls = chart.addLineSeries({ color: '#4fc3f7', lineWidth: 2 });
      ls.setData(session.chartPoints);
      const as = chart.addAreaSeries({
        topColor: 'rgba(79, 195, 247, 0.2)',
        bottomColor: 'rgba(79, 195, 247, 0.02)',
        lineColor: 'transparent',
      });
      as.setData(session.chartPoints);
      chart.timeScale().fitContent();
      setChartInstances((prev) => ({ ...prev, [id]: chart }));
    }).catch(() => {});
  };

  const fmt = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(v) >= 10_000) return (v / 10_000).toFixed(1) + '万';
    return v.toLocaleString();
  };

  return (
    <div className="card mb-4" style={{ padding: 16 }}>
      <div className="card-title mb-3">历史模拟记录 ({sessions.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sessions.map((s) => (
          <div key={s.id}>
            <div
              onClick={() => toggleExpand(s.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                background: expandedId === s.id ? 'var(--bg-active)' : 'var(--bg-tertiary)',
                border: `1px solid ${expandedId === s.id ? 'var(--color-accent)' : 'var(--border-subtle)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {new Date(s.createdAt).toLocaleString('zh-CN')}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: s.totalPnl >= 0 ? 'var(--color-up)' : 'var(--color-down)',
                }}>
                  {s.totalPnl >= 0 ? '+' : ''}{s.totalPnl.toLocaleString()}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: s.totalPnlPct >= 0 ? 'var(--color-up)' : 'var(--color-down)',
                }}>
                  ({s.totalPnlPct >= 0 ? '+' : ''}{s.totalPnlPct.toFixed(2)}%)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {s.transactionCount}笔 · {s.holdings.length}只持仓
                </span>
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                  style={{ fontSize: 10, color: 'var(--color-down)', padding: '2px 6px' }}>
                  删除
                </button>
                <span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>
                  {expandedId === s.id ? '▾' : '▸'}
                </span>
              </div>
            </div>

            {expandedId === s.id && (
              <div style={{
                marginTop: 8, padding: 16, borderRadius: 8,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[
                    { label: '投入', value: fmt(s.initialBalance) },
                    { label: '最终资产', value: fmt(s.finalBalance) },
                    { label: '股票市值', value: fmt(s.stockValue) },
                    { label: '剩余现金', value: fmt(s.cashBalance) },
                  ].map((d) => (
                    <div key={d.label}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{d.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{d.value}</div>
                    </div>
                  ))}
                </div>

                {s.chartPoints.length > 1 && (
                  <div ref={(el) => chartRefCallback(s.id, el)}
                    style={{ width: '100%', height: 200, marginBottom: 12, borderRadius: 6, overflow: 'hidden' }} />
                )}

                {s.aiSummary && (
                  <div style={{
                    padding: 12, borderRadius: 6, marginBottom: 12,
                    background: 'var(--bg-primary)', borderLeft: '3px solid var(--color-accent)',
                    fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 600, marginBottom: 4 }}>AI 总结</div>
                    {s.aiSummary}
                  </div>
                )}

                {s.holdings.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>期末持仓</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {s.holdings.map((h) => (
                        <span key={h.symbol} style={{
                          padding: '3px 10px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)',
                          background: 'var(--bg-primary)', color: 'var(--color-accent)',
                        }}>
                          {h.symbol} {h.shares}股 @ {h.avgCost.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
