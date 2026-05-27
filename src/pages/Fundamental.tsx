import { useState } from 'react';
import { financialData, announcements, hotStocks } from '../utils/mockData';

export default function Fundamental() {
  const [selectedStock] = useState(hotStocks[0]);
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">基本面分析</h1>
        <p className="page-desc">公司概况 · 财务数据 · 估值分析 · 机构持仓</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        {/* Stock selector + tabs */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2 items-center">
            <span style={{ fontWeight: 600, fontSize: '16px' }}>{selectedStock.symbol} {selectedStock.name}</span>
            <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{selectedStock.market === 'HK' ? '港股' : '美股'}</span>
          </div>
          <div className="tabs">
            {[
              { key: 'overview', label: '公司概况' },
              { key: 'financials', label: '财务数据' },
              { key: 'valuation', label: '估值分析' },
              { key: 'holders', label: '股东持仓' },
              { key: 'announcements', label: '公司公告' },
            ].map((t) => (
              <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="dashboard-grid fixed-2col">
            <div className="card">
              <div className="card-title mb-4">基本信息</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                {[
                  ['公司全称', 'Tencent Holdings Ltd'],
                  ['中文名称', '腾讯控股有限公司'],
                  ['交易所', '香港联交所'],
                  ['行业', '信息技术 - 互联网服务'],
                  ['上市日期', '2004-06-16'],
                  ['总股本', '93.82亿股'],
                  ['流通股本', '85.10亿股'],
                  ['官网', 'www.tencent.com'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                    <div style={{ marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title mb-4">主营构成</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { name: '增值服务', pct: 45 },
                  { name: '金融科技', pct: 30 },
                  { name: '广告业务', pct: 15 },
                  { name: '其他', pct: 10 },
                ].map((seg) => (
                  <div key={seg.name}>
                    <div className="flex justify-between mb-1" style={{ fontSize: '13px' }}>
                      <span>{seg.name}</span><span>{seg.pct}%</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${seg.pct}%`, background: 'var(--color-accent)', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title mb-4">分红记录</div>
              <table className="data-table">
                <thead><tr><th>年度</th><th>每股派息</th><th>股息率</th><th>除权日</th></tr></thead>
                <tbody>
                  {[
                    ['2023', '3.40 HKD', '0.88%', '2024-05-17'],
                    ['2022', '2.40 HKD', '0.72%', '2023-05-19'],
                    ['2021', '1.60 HKD', '0.52%', '2022-05-20'],
                  ].map(([year, div, rate, date]) => (
                    <tr key={year}><td>{year}</td><td>{div}</td><td>{rate}</td><td>{date}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div>
            <div className="card mb-4">
              <div className="card-title mb-4">营收 & 净利润趋势（亿港元）</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', height: 200, padding: '0 20px' }}>
                {financialData.years.map((year, i) => (
                  <div key={year} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'flex-end', height: 160 }}>
                      <div style={{
                        width: 40, background: 'var(--color-accent)', borderRadius: '4px 4px 0 0',
                        height: `${(financialData.revenue[i] / 7000) * 100}%`, opacity: 0.8,
                      }} />
                      <div style={{
                        width: 40, background: 'var(--color-green)', borderRadius: '4px 4px 0 0',
                        height: `${(financialData.netProfit[i] / 2000) * 100}%`,
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 8 }}>{year}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-2" style={{ fontSize: '12px', color: 'var(--text-tertiary)', justifyContent: 'center' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--color-accent)', borderRadius: 2, marginRight: 4 }} /> 营收</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--color-green)', borderRadius: 2, marginRight: 4 }} /> 净利润</span>
              </div>
            </div>

            <div className="dashboard-grid fixed-3col">
              {[
                { label: 'ROE', value: `${financialData.roe}%` },
                { label: 'ROA', value: `${financialData.roa}%` },
                { label: '毛利率', value: `${financialData.grossMargin}%` },
                { label: '净利率', value: `${financialData.netMargin}%` },
                { label: '资产负债率', value: `${financialData.debtRatio}%` },
                { label: '经营现金流', value: '1,856亿' },
              ].map((m) => (
                <div key={m.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{m.label}</div>
                  <div className="stat-value" style={{ fontSize: '24px', marginTop: 4 }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'valuation' && (
          <div className="dashboard-grid fixed-2col">
            <div className="card">
              <div className="card-title mb-4">估值指标</div>
              <table className="data-table">
                <thead><tr><th>指标</th><th>当前</th><th>5年高</th><th>5年低</th><th>5年中位</th></tr></thead>
                <tbody>
                  <tr>
                    <td>PE(TTM)</td>
                    <td>{financialData.pe.current}</td>
                    <td>{financialData.pe.high_5y}</td>
                    <td>{financialData.pe.low_5y}</td>
                    <td style={{ color: 'var(--text-tertiary)' }}>{financialData.pe.median_5y}</td>
                  </tr>
                  <tr>
                    <td>PB</td>
                    <td>{financialData.pb.current}</td>
                    <td>{financialData.pb.high_5y}</td>
                    <td>{financialData.pb.low_5y}</td>
                    <td style={{ color: 'var(--text-tertiary)' }}>{financialData.pb.median_5y}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card-title mb-4">DCF 估值计算器</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  ['增长率', '8%'],
                  ['折现率(WACC)', '10%'],
                  ['永续增长率', '3%'],
                  ['自由现金流', '1,500亿'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                    <input className="input" style={{ width: 120, textAlign: 'right' }} defaultValue={val} />
                  </div>
                ))}
                <button className="btn btn-primary w-full mt-2">计算估值</button>
                <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-tertiary)' }}>估算内在价值: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>425.60 HKD</span></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'holders' && (
          <div className="dashboard-grid fixed-2col">
            <div className="card">
              <div className="card-title mb-4">前十大股东</div>
              <table className="data-table">
                <thead><tr><th>股东名称</th><th>持股比例</th><th>较上期</th></tr></thead>
                <tbody>
                  {[
                    ['MIH TC Holdings', '28.5%', '+0.0%'],
                    ['马化腾', '8.4%', '+0.0%'],
                    ['Vanguard Group', '3.2%', '+0.3%'],
                    ['BlackRock', '2.8%', '-0.1%'],
                    ['Capital Group', '2.1%', '+0.2%'],
                  ].map(([name, pct, change]) => (
                    <tr key={name}>
                      <td>{name}</td><td>{pct}</td>
                      <td className={change.startsWith('+') ? 'color-up' : 'color-down'}>{change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card-title mb-4">机构持仓变动</div>
              <table className="data-table">
                <thead><tr><th>机构</th><th>持股数</th><th>占比</th><th>季度变动</th></tr></thead>
                <tbody>
                  {[
                    ['Vanguard', '3.01亿', '3.2%', '+1,200万'],
                    ['BlackRock', '2.63亿', '2.8%', '-500万'],
                    ['Capital Group', '1.97亿', '2.1%', '+800万'],
                    ['Fidelity', '1.52亿', '1.6%', '+300万'],
                  ].map(([inst, shares, pct, change]) => (
                    <tr key={inst}>
                      <td>{inst}</td><td>{shares}</td><td>{pct}</td>
                      <td className={change.startsWith('+') ? 'color-up' : 'color-down'}>{change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="card">
            <table className="data-table">
              <thead><tr><th>日期</th><th>类型</th><th>标题</th><th>操作</th></tr></thead>
              <tbody>
                {announcements.map((a, i) => (
                  <tr key={i}>
                    <td>{a.date}</td>
                    <td><span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{a.type}</span></td>
                    <td>{a.title}</td>
                    <td><button className="btn btn-sm">查看</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
