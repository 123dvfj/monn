import { useState } from 'react';
import { sectorData } from '../utils/mockData';

export default function Review() {
  const [activeTab, setActiveTab] = useState('history');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">复盘统计</h1>
        <p className="page-desc">历史回溯 · 选股成功率 · 板块热度复盘</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        <div className="tabs mb-4" style={{ display: 'inline-flex' }}>
          {['history', 'success', 'sector'].map((t) => (
            <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
              {{ history: '历史回溯', success: '选股统计', sector: '板块复盘' }[t]}
            </button>
          ))}
        </div>

        {activeTab === 'history' && (
          <div>
            <div className="card mb-4">
              <div className="card-header">
                <span className="card-title">K线历史回放</span>
                <div className="flex gap-2">
                  <button className="btn btn-sm">1x</button>
                  <button className="btn btn-sm btn-primary">2x</button>
                  <button className="btn btn-sm">5x</button>
                  <button className="btn btn-sm">10x</button>
                </div>
              </div>
              <div style={{
                height: 400, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px dashed var(--border-primary)', color: 'var(--text-tertiary)', fontSize: '14px',
              }}>
                选择日期后，K线回放将在此区域展示
              </div>
              <div className="flex gap-2 mt-4">
                <input className="input" type="date" defaultValue="2024-06-01" />
                <button className="btn btn-primary">开始回放</button>
                <button className="btn">训练模式</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'success' && (
          <div>
            <div className="dashboard-grid fixed-3col mb-4">
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>总选股次数</div>
                <div className="stat-value" style={{ marginTop: 8 }}>156</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>选股成功率 (5日)</div>
                <div className="stat-value color-up" style={{ marginTop: 8 }}>68.5%</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>平均收益率</div>
                <div className="stat-value color-up" style={{ marginTop: 8 }}>+3.25%</div>
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-title mb-4">选股方案对比</div>
              <table className="data-table">
                <thead>
                  <tr><th>方案名称</th><th>执行次数</th><th>成功率</th><th>平均收益</th><th>最大回撤</th><th>夏普比</th></tr>
                </thead>
                <tbody>
                  {[
                    { name: '低估值高成长', runs: 48, rate: '72.9%', avg: '+4.2%', maxdd: '-8.5%', sharpe: '1.85' },
                    { name: '超跌反弹', runs: 62, rate: '64.5%', avg: '+2.8%', maxdd: '-12.3%', sharpe: '1.20' },
                    { name: '高股息', runs: 46, rate: '69.6%', avg: '+2.1%', maxdd: '-5.2%', sharpe: '1.55' },
                  ].map((row) => (
                    <tr key={row.name}>
                      <td style={{ fontWeight: 500 }}>{row.name}</td>
                      <td>{row.runs}</td>
                      <td className="color-up">{row.rate}</td>
                      <td className="color-up">{row.avg}</td>
                      <td className="color-down">{row.maxdd}</td>
                      <td>{row.sharpe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-title mb-4">AI 优化建议</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p>1. "低估值高成长"方案中，加入"北向资金连续3日净流入"条件后，历史回测成功率从 72.9% 提升至 78.2%。</p>
                <p>2. "超跌反弹"方案在震荡市中表现较好（75%），但在单边下跌市中成功率仅 42%，建议增加大盘趋势过滤条件。</p>
                <p>3. 市值在1000-5000亿的中大盘股选股成功率（71%）显著优于小盘股（53%）。</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sector' && (
          <div>
            <div className="card mb-4">
              <div className="card-title mb-4">每日板块复盘 — 2024-07-01</div>
              <table className="data-table">
                <thead>
                  <tr><th>板块</th><th>涨跌幅</th><th>涨停家数</th><th>资金净流入</th><th>领涨龙头</th><th>驱动因素</th></tr>
                </thead>
                <tbody>
                  {[
                    { name: '新能源', change: '+3.10%', limitUp: 5, inflow: '+8.2亿', leader: '01211', driver: '政策利好+行业数据超预期' },
                    { name: '科技', change: '+2.35%', limitUp: 8, inflow: '+15.6亿', leader: '00700', driver: 'AI概念持续发酵' },
                    { name: '医药', change: '+1.20%', limitUp: 2, inflow: '+2.1亿', leader: '02269', driver: '创新药审批加速' },
                    { name: '金融', change: '+0.85%', limitUp: 0, inflow: '+1.8亿', leader: '00388', driver: '港股通交易活跃' },
                    { name: '地产', change: '-1.15%', limitUp: 0, inflow: '-3.5亿', leader: '00016', driver: '行业数据不及预期' },
                  ].map((s) => (
                    <tr key={s.name}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td className={s.change.startsWith('+') ? 'color-up' : 'color-down'}>{s.change}</td>
                      <td>{s.limitUp}</td>
                      <td className={s.inflow.startsWith('+') ? 'color-up' : 'color-down'}>{s.inflow}</td>
                      <td style={{ color: 'var(--color-accent)' }}>{s.leader}</td>
                      <td style={{ fontSize: '12px' }}>{s.driver}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
