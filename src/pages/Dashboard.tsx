import { useQuotes, useNews, INDEX_SYMBOLS, DEFAULT_HK_STOCKS, DEFAULT_US_STOCKS } from '../hooks/useStockData';
import { hotStocks as fallbackStocks, sectorData, indexData as fallbackIndices } from '../utils/mockData';

export default function Dashboard() {
  const { quotes: indexQuotes, loading: idxLoading } = useQuotes(INDEX_SYMBOLS, 30_000);
  const { quotes: stockQuotes, loading: stkLoading } = useQuotes([...DEFAULT_HK_STOCKS, ...DEFAULT_US_STOCKS], 30_000);
  const { news, loading: newsLoading } = useNews();

  const loading = idxLoading || stkLoading;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">工作台</h1>
        <p className="page-desc">市场概览 · 实时数据 {loading ? '(加载中...)' : '● 在线'}</p>
      </div>

      <div className="dashboard-grid" style={{ padding: '0 28px 20px' }}>
        {/* Index Cards */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span className="card-title">大盘指数</span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              15秒自动刷新
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
            {INDEX_SYMBOLS.map((sym) => {
              const q = indexQuotes.find((x) => x.symbol === sym);
              const fb = fallbackIndices.find((x) => x.symbol === sym);
              const price = q?.regularMarketPrice ?? fb?.price ?? 0;
              const changePct = q?.regularMarketChangePercent ?? fb?.changePercent ?? 0;
              const name = q?.shortName ?? fb?.name ?? sym;
              return (
                <div key={sym} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: 4 }}>{name}</div>
                  <div className="stat-value" style={{ fontSize: '20px' }}>
                    {price ? price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '---'}
                  </div>
                  <span className={`stat-change ${changePct >= 0 ? 'color-up' : 'color-down'}`}>
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hot Stocks */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">热门个股</span>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>代码</th><th>名称</th><th>最新价</th><th>涨跌幅</th><th>成交量</th></tr>
            </thead>
            <tbody>
              {(stockQuotes.length > 0 ? stockQuotes : fallbackStocks).map((item: any) => {
                const isReal = 'regularMarketPrice' in item;
                const symbol = item.symbol ?? '';
                const name = item.shortName ?? item.name ?? '';
                const price = isReal ? item.regularMarketPrice : item.price;
                const changePct = isReal ? item.regularMarketChangePercent : item.changePercent;
                const volume = isReal ? item.regularMarketVolume : item.volume;
                return (
                  <tr key={symbol}>
                    <td style={{ color: 'var(--color-accent)' }}>{symbol}</td>
                    <td>{(name ?? '').length > 20 ? (name ?? '').slice(0, 20) + '...' : name}</td>
                    <td>{price?.toFixed?.(2) ?? '---'}</td>
                    <td className={changePct >= 0 ? 'color-up' : 'color-down'}>
                      {changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '---'}
                    </td>
                    <td>{volume ? `${(volume / 10000).toFixed(0)}万` : '---'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Sectors — keep mock for now (Yahoo doesn't have free sector data) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">板块热度</span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>模拟数据</span>
          </div>
          <table className="data-table">
            <thead><tr><th>板块</th><th>涨跌幅</th><th>领涨股</th></tr></thead>
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
            {!newsLoading && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Yahoo Finance</span>}
          </div>
          {newsLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>加载中...</div>
          ) : news.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 400, overflow: 'auto' }}>
              {news.slice(0, 15).map((n, i) => (
                <a
                  key={i}
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0',
                    borderBottom: '1px solid var(--border-subtle)', textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    资讯
                  </span>
                  <span style={{ flex: 1, fontSize: '13px' }}>{n.title}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {n.publisher}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              暂无资讯数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
