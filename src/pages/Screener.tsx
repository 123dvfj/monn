import { useState } from 'react';
import { useQuotes, DEFAULT_HK_STOCKS, DEFAULT_US_STOCKS } from '../hooks/useStockData';

type Condition = {
  id: string;
  category: string;
  name: string;
  type: 'range' | 'select';
  min?: number;
  max?: number;
  options?: string[];
  value?: any;
};

const conditions: Condition[] = [
  { id: 'pe', category: '估值', name: 'PE(TTM)', type: 'range', min: 0, max: 100 },
  { id: 'pb', category: '估值', name: 'PB', type: 'range', min: 0, max: 20 },
  { id: 'change', category: '行情', name: '涨跌幅%', type: 'range', min: -20, max: 20 },
  { id: 'volume', category: '行情', name: '换手率%', type: 'range', min: 0, max: 50 },
  { id: 'market', category: '市场', name: '市场', type: 'select', options: ['全部', '港股', '美股'] },
  { id: 'roe', category: '财务', name: 'ROE%', type: 'range', min: 0, max: 50 },
  { id: 'marketCap', category: '规模', name: '市值(亿)', type: 'range', min: 10, max: 50000 },
  { id: 'dividend', category: '回报', name: '股息率%', type: 'range', min: 0, max: 10 },
];

const savedStrategies = [
  { name: '低估值高成长', desc: 'PE<20, ROE>15%, 市值>1000亿' },
  { name: '超跌反弹', desc: '跌幅>5%, 换手率>3%' },
  { name: '高股息', desc: '股息率>3%, PE<15' },
];

export default function Screener() {
  const { quotes } = useQuotes([...DEFAULT_HK_STOCKS, ...DEFAULT_US_STOCKS], 30_000);
  const [activeConditions, setActiveConditions] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);

  const toggleCondition = (id: string) => {
    setActiveConditions((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const runScreener = () => {
    setResults(quotes.filter((q) => q.regularMarketPrice > 0));
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">智能选股</h1>
        <p className="page-desc">技术条件 · 基本面 · 形态 · 板块热点</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
          {/* Left Panel - Conditions */}
          <div>
            <div className="card mb-4">
              <div className="card-title mb-4">选股条件</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['估值', '行情', '市场', '财务', '规模', '回报'].map((cat) => (
                  <div key={cat}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4, marginTop: 4 }}>
                      {cat}
                    </div>
                    {conditions.filter((c) => c.category === cat).map((cond) => (
                      <div
                        key={cond.id}
                        className={`sidebar-item ${activeConditions.includes(cond.id) ? 'active' : ''}`}
                        onClick={() => toggleCondition(cond.id)}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        + {cond.name}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <button className="btn btn-primary w-full mt-4" onClick={runScreener}>
                执行选股
              </button>
            </div>

            <div className="card">
              <div className="card-title mb-4">已保存方案</div>
              {savedStrategies.map((s) => (
                <div key={s.name} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.desc}</div>
                </div>
              ))}
              <button className="btn btn-sm mt-3">+ 保存当前方案</button>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">选股结果 ({results.length})</span>
                <button className="btn btn-sm">导出CSV</button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>代码</th><th>名称</th><th>市场</th><th>最新价</th><th>涨跌幅</th><th>PE</th><th>市值</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((s: any) => {
                    const sym = s.symbol ?? '';
                    const isHK = /^\d{5}$/.test(sym);
                    const name = s.shortName ?? s.name ?? '';
                    const price = s.regularMarketPrice ?? s.price ?? 0;
                    const changePct = s.regularMarketChangePercent ?? s.changePercent ?? 0;
                    const pe = s.trailingPE ?? s.pe;
                    const mktCap = s.marketCap;
                    return (
                      <tr key={sym}>
                        <td style={{ color: 'var(--color-accent)' }}>{sym}</td>
                        <td>{(name ?? '').length > 20 ? (name ?? '').slice(0, 18) + '...' : name}</td>
                        <td>{isHK ? '港股' : '美股'}</td>
                        <td>{price ? price.toFixed(2) : '---'}</td>
                        <td className={changePct >= 0 ? 'color-up' : 'color-down'}>
                          {changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '---'}
                        </td>
                        <td>{pe?.toFixed(1) ?? '-'}</td>
                        <td>{mktCap ? `${(mktCap / 1e8).toFixed(0)}亿` : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
