import { useState, useMemo } from 'react';
import { useQuotes, ALL_HK_STOCKS, ALL_US_STOCKS } from '../hooks/useStockData';
import type { YQuote } from '../services/yahooFinance';

interface FilterCondition {
  id: string;
  name: string;
  enabled: boolean;
  min: string;
  max: string;
  // Which field to filter on
  field: keyof YQuote;
}

export default function Screener() {
  const { quotes, loading } = useQuotes([...ALL_HK_STOCKS, ...ALL_US_STOCKS], 60_000);

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
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const results = useMemo(() => {
    return quotes.filter((q) => {
      const sym = q.symbol ?? '';
      const isHK = /^\d{5}$/.test(sym);
      if (marketSelect === 'HK' && !isHK) return false;
      if (marketSelect === 'US' && isHK) return false;

      for (const f of filters) {
        if (!f.enabled) continue;

        if (f.id === 'market') continue; // handled above

        if (f.id === 'volume') {
          const vol = (q.regularMarketVolume ?? 0) / 10000; // convert to 万
          if (f.min && vol < Number(f.min)) return false;
          if (f.max && vol > Number(f.max)) return false;
          continue;
        }

        if (f.id === 'marketCap') {
          const cap = (q.marketCap ?? 0) / 1e8; // convert to 亿
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

  // Sort by change% desc by default
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) =>
      (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0)
    );
  }, [results]);

  const enabledCount = filters.filter((f) => f.enabled).length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">智能选股</h1>
        <p className="page-desc">
          {loading ? '加载数据中...' : `${quotes.filter(q => q.regularMarketPrice > 0).length} 只股票可用 · ${enabledCount} 个筛选条件`}
        </p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
          {/* Left - Filters */}
          <div>
            <div className="card mb-4">
              <div className="card-title mb-3">市场</div>
              <div className="tabs" style={{ display: 'inline-flex' }}>
                {['ALL', 'HK', 'US'].map((m) => (
                  <button key={m} className={`tab ${marketSelect === m ? 'active' : ''}`}
                    onClick={() => setMarketSelect(m)}>
                    {{ ALL: '全部', HK: '港股', US: '美股' }[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-title mb-4">筛选条件</div>
              {filters.map((f) => (
                <div key={f.id} style={{ marginBottom: 12 }}>
                  <div
                    className="flex justify-between items-center"
                    style={{ padding: '6px 0', cursor: 'pointer' }}
                    onClick={() => toggleFilter(f.id)}
                  >
                    <span style={{ fontSize: '13px', fontWeight: f.enabled ? 600 : 400, color: f.enabled ? 'var(--color-accent)' : 'var(--text-secondary)' }}>
                      {f.enabled ? '✓ ' : ''}{f.name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      {f.enabled ? '启用' : '点击启用'}
                    </span>
                  </div>
                  {f.enabled && f.id !== 'market' && (
                    <div className="flex gap-2 mt-1">
                      <input
                        className="input"
                        placeholder="最小"
                        value={f.min}
                        onChange={(e) => updateFilter(f.id, { min: e.target.value })}
                        style={{ width: '50%', fontSize: '12px', padding: '4px 8px' }}
                      />
                      <input
                        className="input"
                        placeholder="最大"
                        value={f.max}
                        onChange={(e) => updateFilter(f.id, { max: e.target.value })}
                        style={{ width: '50%', fontSize: '12px', padding: '4px 8px' }}
                      />
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

          {/* Right - Results */}
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
                    const price = s.regularMarketPrice ?? 0;
                    const chg = s.regularMarketChangePercent ?? 0;
                    const pe = s.trailingPE ?? '';
                    const cap = s.marketCap ? s.marketCap / 1e8 : '';
                    csv.push(`${sym},${name},${isHK ? 'HK' : 'US'},${price},${chg},${pe},${cap}`);
                  });
                  const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'screener_results.csv'; a.click();
                }}>导出CSV</button>
              </div>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>加载中...</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>代码</th><th>名称</th><th>市场</th><th>最新价</th><th>涨跌幅</th><th>PE</th><th>市值(亿)</th></tr>
                  </thead>
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
      </div>
    </div>
  );
}
