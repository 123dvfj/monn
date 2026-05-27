import { capitalFlow, chipDistribution } from '../utils/mockData';

export default function Capital() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">资金筹码</h1>
        <p className="page-desc">主力资金 · 龙虎榜 · 北向资金 · 筹码分布</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        {/* Capital Flow Summary */}
        <div className="dashboard-grid fixed-3col mb-4">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>主力净流入</div>
            <div className="stat-value color-up" style={{ fontSize: '28px', marginTop: 8 }}>+{capitalFlow.mainInflow}亿</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>大单买入 vs 卖出</div>
            <div className="flex justify-between mt-2" style={{ padding: '0 16px' }}>
              <div><span className="stat-value color-up" style={{ fontSize: '20px' }}>{capitalFlow.bigOrderBuy}</span><div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>买入(手)</div></div>
              <div><span className="stat-value color-down" style={{ fontSize: '20px' }}>{capitalFlow.bigOrderSell}</span><div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>卖出(手)</div></div>
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>北向资金净流入</div>
            <div className="stat-value color-up" style={{ fontSize: '28px', marginTop: 8 }}>+{capitalFlow.northBound}亿</div>
          </div>
        </div>

        {/* Fund Flow Detail */}
        <div className="card mb-4">
          <div className="card-title mb-4">资金流向（按单量拆分）</div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              {[
                { label: '超大单', inflow: 1.85, outflow: 1.20 },
                { label: '大单', inflow: 0.85, outflow: 0.60 },
                { label: '中单', inflow: 0.45, outflow: 0.55 },
                { label: '小单', inflow: 0.30, outflow: 0.40 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 mb-3">
                  <span style={{ width: 50, fontSize: '12px', color: 'var(--text-secondary)' }}>{item.label}</span>
                  <div style={{ flex: 1, height: 20, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${(item.inflow / 2.5) * 100}%`, background: 'var(--color-up)', opacity: 0.7, transition: 'width 0.3s' }} />
                    <div style={{ flex: 1 }} />
                  </div>
                  <span style={{ width: 50, textAlign: 'right', fontSize: '12px', color: 'var(--color-up)' }}>+{item.inflow}亿</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chip Distribution */}
        <div className="card mb-4">
          <div className="card-title mb-4">筹码分布图</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: 180, paddingLeft: 40 }}>
            {chipDistribution.map((chip) => (
              <div key={chip.price} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: `${(chip.volume / 120000) * 100}%`,
                  background: chip.price >= 395 ? 'var(--color-down)' : 'var(--color-up)',
                  opacity: 0.6,
                  borderRadius: '2px 2px 0 0',
                  minWidth: 20,
                }} />
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 4, transform: 'rotate(-45deg)' }}>
                  {chip.price}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            <span>获利盘: 65%</span>
            <span>平均成本: 392.50</span>
            <span>集中度: 中等</span>
          </div>
        </div>

        {/* Dragon & Tiger List */}
        <div className="card">
          <div className="card-title mb-4">龙虎榜</div>
          <table className="data-table">
            <thead>
              <tr><th>个股</th><th>上榜原因</th><th>买入前五</th><th>卖出前五</th><th>净买入</th></tr>
            </thead>
            <tbody>
              {[
                { symbol: '00700', reason: '日涨幅偏离值达7%', buy: '12.5亿', sell: '8.2亿', net: '+4.3亿' },
                { symbol: '01810', reason: '连续三个交易日涨幅20%', buy: '8.8亿', sell: '5.1亿', net: '+3.7亿' },
                { symbol: '09618', reason: '日跌幅偏离值达7%', buy: '3.2亿', sell: '6.5亿', net: '-3.3亿' },
              ].map((row) => (
                <tr key={row.symbol}>
                  <td style={{ color: 'var(--color-accent)' }}>{row.symbol}</td>
                  <td>{row.reason}</td>
                  <td>{row.buy}</td>
                  <td>{row.sell}</td>
                  <td className={row.net.startsWith('+') ? 'color-up' : 'color-down'}>{row.net}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
