import { useState } from 'react';
import { newsItems } from '../utils/mockData';

export default function News() {
  const [filter, setFilter] = useState('all');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">资讯舆情</h1>
        <p className="page-desc">个股新闻 · 行业政策 · 利好利空识别 · 调研信息</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
          {/* Main News Feed */}
          <div>
            <div className="flex gap-2 mb-4">
              {[
                { key: 'all', label: '全部' },
                { key: 'positive', label: '利好' },
                { key: 'negative', label: '利空' },
                { key: 'neutral', label: '中性' },
              ].map((f) => (
                <button
                  key={f.key}
                  className={`btn btn-sm ${filter === f.key ? 'btn-primary' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
              <input className="input" placeholder="搜索新闻关键词..." style={{ marginLeft: 'auto', width: 220 }} />
            </div>

            <div className="card">
              {newsItems.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '14px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    className={`badge ${
                      n.sentiment === 'positive' ? 'badge-up' :
                      n.sentiment === 'negative' ? 'badge-down' : ''
                    }`}
                    style={
                      n.sentiment === 'neutral'
                        ? { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }
                        : {}
                    }
                  >
                    {{ positive: '利好', negative: '利空', neutral: '中性' }[n.sentiment]}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.5 }}>{n.title}</div>
                    {n.symbol && (
                      <span style={{ fontSize: '11px', color: 'var(--color-accent)', marginTop: 4, display: 'inline-block' }}>
                        {n.symbol}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {n.source}<br />{n.time}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Side panels */}
          <div>
            <div className="card mb-4">
              <div className="card-title mb-4">舆情热点</div>
              {[
                { topic: 'AI 人工智能', heat: 95 },
                { topic: '新能源车', heat: 82 },
                { topic: '港股通扩容', heat: 78 },
                { topic: '美联储利率', heat: 65 },
                { topic: '半导体', heat: 60 },
              ].map((t) => (
                <div key={t.topic} className="flex justify-between items-center mb-3">
                  <span style={{ fontSize: '13px' }}>{t.topic}</span>
                  <div style={{ width: 80, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${t.heat}%`, background: t.heat > 80 ? 'var(--color-down)' : 'var(--color-warning)', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="card mb-4">
              <div className="card-title mb-4">机构调研排行</div>
              {[
                { symbol: '00700', name: 'Tencent', visits: 35 },
                { symbol: '01810', name: 'Xiaomi', visits: 28 },
                { symbol: 'AAPL', name: 'Apple', visits: 22 },
              ].map((v) => (
                <div key={v.symbol} className="flex justify-between items-center mb-3" style={{ fontSize: '13px' }}>
                  <span>
                    <span style={{ color: 'var(--color-accent)' }}>{v.symbol}</span> {v.name}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{v.visits}次调研</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-title mb-4">研报评级变动</div>
              {[
                { symbol: '00700', broker: '摩根士丹利', rating: '上调 → 买入', target: 450 },
                { symbol: '09988', broker: '高盛', rating: '维持 买入', target: 95 },
                { symbol: 'TSLA', broker: '花旗', rating: '下调 → 中性', target: 170 },
              ].map((r, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '13px' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-accent)' }}>{r.symbol}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{r.broker}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>{r.rating}</span>
                    <span style={{ fontWeight: 500 }}>目标价 {r.target}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
