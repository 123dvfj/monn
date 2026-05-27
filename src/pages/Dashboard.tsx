import { indexData, hotStocks, sectorData, newsItems } from '../utils/mockData';

export default function Dashboard() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">工作台</h1>
        <p className="page-desc">市场概览 & 自选股动态</p>
      </div>

      <div className="dashboard-grid" style={{ padding: '0 28px 20px' }}>
        {/* Index Cards */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span className="card-title">大盘指数</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
            {indexData.map((idx) => (
              <div key={idx.symbol} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: 4 }}>{idx.name}</div>
                <div className="stat-value" style={{ fontSize: '20px' }}>{idx.price.toLocaleString()}</div>
                <span className={`stat-change ${idx.changePercent >= 0 ? 'color-up' : 'color-down'}`}>
                  {idx.changePercent >= 0 ? '+' : ''}{idx.changePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hot Stocks */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">热门个股</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>代码</th><th>名称</th><th>最新价</th><th>涨跌幅</th><th>成交量</th>
              </tr>
            </thead>
            <tbody>
              {hotStocks.map((s) => (
                <tr key={s.symbol}>
                  <td style={{ color: 'var(--color-accent)' }}>{s.symbol}</td>
                  <td>{s.name}</td>
                  <td>{s.price.toFixed(2)}</td>
                  <td className={s.changePercent >= 0 ? 'color-up' : 'color-down'}>
                    {s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(2)}%
                  </td>
                  <td>{(s.volume / 10000).toFixed(0)}万</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sectors */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">板块热度</span>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>板块</th><th>涨跌幅</th><th>领涨股</th></tr>
            </thead>
            <tbody>
              {sectorData.map((sc) => (
                <tr key={sc.name}>
                  <td>{sc.name}</td>
                  <td className={sc.changePercent >= 0 ? 'color-up' : 'color-down'}>
                    {sc.changePercent >= 0 ? '+' : ''}{sc.changePercent.toFixed(2)}%
                  </td>
                  <td style={{ color: 'var(--color-accent)' }}>{sc.leadingStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* News Feed */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span className="card-title">实时资讯</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {newsItems.map((n) => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className={`badge ${n.sentiment === 'positive' ? 'badge-up' : n.sentiment === 'negative' ? 'badge-down' : ''}`}
                  style={n.sentiment === 'neutral' ? { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' } : {}}>
                  {n.sentiment === 'positive' ? '利好' : n.sentiment === 'negative' ? '利空' : '中性'}
                </span>
                <span style={{ flex: 1, fontSize: '13px' }}>{n.title}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{n.source} · {n.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
