import { useState, useMemo } from 'react';
import { useStore } from '../stores/useStore';
import { useQuotes, ALL_HK_STOCKS, ALL_US_STOCKS } from '../hooks/useStockData';

const ALL_STOCKS = [...ALL_HK_STOCKS, ...ALL_US_STOCKS];

export default function Tools() {
  const [activeTab, setActiveTab] = useState('watchlist');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">辅助工具</h1>
        <p className="page-desc">自选管理 · 预警设置 · 交易笔记</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        <div className="tabs mb-4" style={{ display: 'inline-flex' }}>
          {['watchlist', 'alerts', 'notes'].map((t) => (
            <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
              {{ watchlist: '自选股', alerts: '价格预警', notes: '交易笔记' }[t]}
            </button>
          ))}
        </div>

        {activeTab === 'watchlist' && <WatchlistPanel />}
        {activeTab === 'alerts' && <AlertsPanel />}
        {activeTab === 'notes' && <NotesPanel />}
      </div>
    </div>
  );
}

/* ==================== Watchlist ==================== */
function WatchlistPanel() {
  const { watchlistGroups, addWatchlistGroup, removeWatchlistGroup, addToWatchlist, removeFromWatchlist } = useStore();
  const [newGroupName, setNewGroupName] = useState('');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [activeGroup, setActiveGroup] = useState(watchlistGroups[0]?.id ?? '');
  const [showAddStock, setShowAddStock] = useState(false);

  const currentGroup = watchlistGroups.find((g) => g.id === activeGroup);
  const allWatchlistSymbols = [...new Set(watchlistGroups.flatMap((g) => g.stocks))];
  const { quotes } = useQuotes(allWatchlistSymbols, 30_000);

  const getQuote = (sym: string) => quotes.find((q) => q.symbol === sym);

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    addWatchlistGroup(newGroupName.trim());
    setNewGroupName('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px' }}>
      {/* Group List */}
      <div>
        <div className="card mb-4">
          <div style={{ display: 'flex', gap: '6px', marginBottom: 12 }}>
            <input
              className="input flex-1"
              placeholder="新分组名称"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
            />
            <button className="btn btn-primary btn-sm" onClick={handleAddGroup}>新建</button>
          </div>
          {watchlistGroups.map((g) => (
            <div
              key={g.id}
              className={`sidebar-item ${activeGroup === g.id ? 'active' : ''}`}
              onClick={() => setActiveGroup(g.id)}
              style={{ justifyContent: 'space-between' }}
            >
              <span>{g.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{g.stocks.length}</span>
              {g.stocks.length === 0 && (
                <button
                  className="btn btn-sm btn-danger"
                  style={{ padding: '0 6px', fontSize: '10px' }}
                  onClick={(e) => { e.stopPropagation(); removeWatchlistGroup(g.id); }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stock List */}
      <div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">{currentGroup?.name ?? '自选股'}</span>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddStock(!showAddStock)}>
              + 添加股票
            </button>
          </div>

          {showAddStock && (
            <div className="flex gap-2 mb-4">
              <input
                className="input flex-1"
                placeholder="搜索股票代码或名称..."
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
              />
              <select className="input" style={{ width: 80 }}>
                <option>港股</option>
                <option>美股</option>
              </select>
            </div>
          )}
          {showAddStock && searchSymbol && (
            <div className="mb-4" style={{ maxHeight: 200, overflow: 'auto' }}>
              {ALL_STOCKS
                .filter((s) => s.includes(searchSymbol.toUpperCase()))
                .slice(0, 20)
                .map((sym) => {
                  const q = getQuote(sym);
                  const isHK = /^\d{5}$/.test(sym);
                  return (
                    <div
                      key={sym}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      className="sidebar-item"
                      onClick={() => {
                        addToWatchlist(activeGroup, sym);
                        setSearchSymbol('');
                        setShowAddStock(false);
                      }}
                    >
                      <span>
                        <span style={{ color: 'var(--color-accent)' }}>{sym}</span>
                        {' '}{q?.shortName ?? sym} · {isHK ? '港股' : '美股'}
                      </span>
                      <span className={(q?.regularMarketChangePercent ?? 0) >= 0 ? 'color-up' : 'color-down'} style={{ fontSize: '12px' }}>
                        {q?.regularMarketPrice ? `${q.regularMarketPrice.toFixed(2)} (${(q.regularMarketChangePercent ?? 0) >= 0 ? '+' : ''}${(q.regularMarketChangePercent ?? 0).toFixed(2)}%)` : '---'}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}

          {currentGroup && currentGroup.stocks.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>代码</th><th>名称</th><th>最新价</th><th>涨跌幅</th><th>市场</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {currentGroup.stocks.map((sym) => {
                  const q = getQuote(sym);
                  const livePrice = q?.regularMarketPrice;
                  const liveChgPct = q?.regularMarketChangePercent ?? 0;
                  const liveName = q?.shortName ?? sym;
                  const isHK = /^\d{5}$/.test(sym);
                  return (
                    <tr key={sym}>
                      <td style={{ color: 'var(--color-accent)' }}>{sym}</td>
                      <td>{liveName}</td>
                      <td className="font-mono">{livePrice ? livePrice.toFixed(2) : '-'}</td>
                      <td className={liveChgPct >= 0 ? 'color-up' : 'color-down'}>
                        {livePrice ? `${liveChgPct >= 0 ? '+' : ''}${liveChgPct.toFixed(2)}%` : '-'}
                      </td>
                      <td>{isHK ? '港股' : q?.exchangeName === 'NMS' || q?.exchangeName === 'NYQ' ? '美股' : isHK ? '港股' : '美股'}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => removeFromWatchlist(activeGroup, sym)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              暂无股票，点击"添加股票"开始
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== Alerts ==================== */
function AlertsPanel() {
  const { alerts, addAlert, toggleAlert, removeAlert } = useStore();
  const [newAlert, setNewAlert] = useState({ symbol: '', type: 'price_above' as const, value: 0 });

  const handleAdd = () => {
    if (!newAlert.symbol || newAlert.value <= 0) return;
    addAlert(newAlert);
    setNewAlert({ symbol: '', type: 'price_above', value: 0 });
  };

  const typeLabels: Record<string, string> = {
    price_above: '价格突破',
    price_below: '价格跌破',
    change_up: '涨幅超过',
    change_down: '跌幅超过',
    volume: '成交量超过',
  };

  return (
    <div>
      <div className="card mb-4">
        <div className="card-title mb-4">新建预警</div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>股票代码</div>
            <input className="input" style={{ width: 120 }} placeholder="如 00700" value={newAlert.symbol}
              onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>条件类型</div>
            <select className="input" value={newAlert.type}
              onChange={(e) => setNewAlert({ ...newAlert, type: e.target.value as any })}>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>阈值</div>
            <input className="input" style={{ width: 100 }} type="number" value={newAlert.value || ''}
              onChange={(e) => setNewAlert({ ...newAlert, value: Number(e.target.value) })} />
          </div>
          <button className="btn btn-primary" onClick={handleAdd}>添加预警</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title mb-4">预警列表</div>
        {alerts.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>暂无预警</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>代码</th><th>条件</th><th>阈值</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td style={{ color: 'var(--color-accent)' }}>{a.symbol}</td>
                  <td>{typeLabels[a.type] ?? a.type}</td>
                  <td>{a.value}</td>
                  <td>
                    <span className={`badge ${a.enabled ? 'badge-up' : ''}`}
                      style={!a.enabled ? { background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' } : {}}>
                      {a.enabled ? '启用' : '停用'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => toggleAlert(a.id)}>{a.enabled ? '停用' : '启用'}</button>
                    <button className="btn btn-sm btn-danger" style={{ marginLeft: 4 }} onClick={() => removeAlert(a.id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ==================== Notes ==================== */
function NotesPanel() {
  const { tradeNotes, addTradeNote } = useStore();
  const [note, setNote] = useState({ symbol: '', type: 'buy' as const, price: 0, reason: '', tags: '' });

  const handleAdd = () => {
    if (!note.symbol || !note.reason) return;
    addTradeNote({ symbol: note.symbol, type: note.type, date: new Date().toISOString().split('T')[0], price: note.price, reason: note.reason, tags: note.tags.split(',').map((t) => t.trim()).filter(Boolean) });
    setNote({ symbol: '', type: 'buy', price: 0, reason: '', tags: '' });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div className="card">
        <div className="card-title mb-4">新建笔记</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>股票代码</div>
            <input className="input w-full" placeholder="如 00700" value={note.symbol}
              onChange={(e) => setNote({ ...note, symbol: e.target.value.toUpperCase() })} />
          </div>
          <div className="flex gap-3">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>类型</div>
              <select className="input w-full" value={note.type}
                onChange={(e) => setNote({ ...note, type: e.target.value as any })}>
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>成交价</div>
              <input className="input w-full" type="number" value={note.price || ''}
                onChange={(e) => setNote({ ...note, price: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>交易理由</div>
            <textarea className="input w-full" rows={4} placeholder="记录你的买入/卖出逻辑..."
              value={note.reason} onChange={(e) => setNote({ ...note, reason: e.target.value })}
              style={{ resize: 'vertical' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: 4 }}>标签 (逗号分隔)</div>
            <input className="input w-full" placeholder="如 超跌反弹, MACD金叉" value={note.tags}
              onChange={(e) => setNote({ ...note, tags: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={handleAdd}>保存笔记</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title mb-4">交易笔记列表</div>
        {tradeNotes.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>暂无笔记</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tradeNotes.map((n) => (
              <div key={n.id} style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex gap-2 items-center">
                    <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{n.symbol}</span>
                    <span className={`badge ${n.type === 'buy' ? 'badge-up' : 'badge-down'}`}>{n.type === 'buy' ? '买入' : '卖出'}</span>
                    {n.price > 0 && <span style={{ fontSize: '12px' }}>@{n.price.toFixed(2)}</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{n.date}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.reason}</div>
                {n.tags.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {n.tags.map((t) => <span key={t} className="badge" style={{ background: 'var(--bg-primary)', color: 'var(--text-tertiary)', fontSize: '10px' }}>{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
