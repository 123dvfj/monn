import { useState, useMemo } from 'react';
import { useNews, ALL_HK_STOCKS, ALL_US_STOCKS } from '../hooks/useStockData';

export default function News() {
  const [keyword, setKeyword] = useState('');
  const { news, loading } = useNews([...ALL_HK_STOCKS, ...ALL_US_STOCKS].slice(0, 20));

  const filteredNews = useMemo(() => {
    if (!keyword.trim()) return news;
    const kw = keyword.toLowerCase();
    return news.filter((n) =>
      n.title.toLowerCase().includes(kw) ||
      (n.summary ?? '').toLowerCase().includes(kw) ||
      (n.publisher ?? '').toLowerCase().includes(kw)
    );
  }, [news, keyword]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">资讯舆情</h1>
        <p className="page-desc">{loading ? '实时新闻 · 加载中...' : <><span className="live-dot" />实时新闻 · Yahoo Finance · {news.length} 条</>}</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
          {/* Main News Feed */}
          <div>
            <div className="flex gap-2 mb-4">
              <input
                className="input"
                placeholder="搜索新闻关键词..."
                style={{ width: 220 }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              {keyword && (
                <button className="btn btn-sm" onClick={() => setKeyword('')}>清除</button>
              )}
            </div>

            <div className="card">
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  正在加载 Yahoo Finance 新闻...
                </div>
              ) : filteredNews.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  {keyword ? '没有匹配的新闻' : '暂无新闻数据'}
                </div>
              ) : (
                filteredNews.map((n, i) => (
                  <a
                    key={i}
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '14px 0',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', flexShrink: 0 }}>
                      资讯
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.5 }}>{n.title}</div>
                      {n.summary && (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.4 }}>
                          {n.summary.slice(0, 120)}{n.summary.length > 120 ? '...' : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {n.publisher}<br />
                      {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString('zh-CN') : ''}
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>

          {/* Side panels */}
          <div>
            <div className="card mb-4">
              <div className="card-title mb-4">市场热点（示例）</div>
              {[
                { topic: 'AI 人工智能', heat: 95 },
                { topic: '新能源车', heat: 82 },
                { topic: '美联储利率', heat: 78 },
                { topic: '半导体', heat: 65 },
                { topic: '港股通', heat: 60 },
              ].map((t) => (
                <div key={t.topic} className="flex justify-between items-center mb-3">
                  <span style={{ fontSize: '13px' }}>{t.topic}</span>
                  <div style={{ width: 80, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${t.heat}%`, background: t.heat > 80 ? 'var(--color-down)' : 'var(--color-warning)', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-title mb-4">免责声明</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                新闻数据来源于 Yahoo Finance API，仅供参考。Monn 不保证数据的准确性、完整性或及时性。投资有风险，决策需谨慎。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
