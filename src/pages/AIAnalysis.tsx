import { useState } from 'react';

export default function AIAnalysis() {
  const [activeTab, setActiveTab] = useState('report');
  const [analysisPrompt, setAnalysisPrompt] = useState('');

  const aiRecommendations = [
    { symbol: '00700', name: 'Tencent', score: 85, reason: '技术面MACD金叉+基本面估值低位+资金持续流入', style: '中线稳健', risk: '中低' },
    { symbol: '01810', name: 'Xiaomi', score: 78, reason: 'SU7交付超预期+汽车业务扭亏拐点+板块热度高', style: '短线博弈', risk: '中' },
    { symbol: 'NVDA', name: 'NVIDIA', score: 92, reason: 'AI芯片垄断地位+业绩持续超预期+机构加仓', style: '长线价值', risk: '中低' },
  ];

  const riskAlerts = [
    { symbol: '09988', name: 'BABA', risk: '竞争加剧+监管不确定性+估值承压', level: 'high' },
    { symbol: 'TSLA', name: 'Tesla', risk: '销量下滑+价格战+品牌口碑恶化', level: 'medium' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI 智能分析</h1>
        <p className="page-desc">走势研判 · 风险识别 · 股票推荐 · 智能报告</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        <div className="tabs mb-4" style={{ display: 'inline-flex' }}>
          {[
            { key: 'report', label: '个股分析报告' },
            { key: 'recommend', label: 'AI 股票推荐' },
            { key: 'risk', label: '风险识别' },
            { key: 'predict', label: '走势研判' },
          ].map((t) => (
            <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'report' && (
          <div>
            <div className="card mb-4">
              <div className="flex gap-3 items-center">
                <input
                  className="input flex-1"
                  placeholder="输入股票代码或名称，如 00700 / Tencent / AAPL..."
                  value={analysisPrompt}
                  onChange={(e) => setAnalysisPrompt(e.target.value)}
                />
                <button className="btn btn-primary">生成分析报告</button>
              </div>
            </div>

            {analysisPrompt && (
              <div className="card">
                <div className="card-title mb-4">AI 分析报告 — {analysisPrompt}</div>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {[
                    { title: '技术面概览', content: '日线MACD金叉信号形成，股价站上20日均线，布林带中轨支撑有效。周线级别处于上升通道下沿，短期看涨动能充足。关键压力位 400，支撑位 370。' },
                    { title: '基本面评估', content: '当前PE(TTM) 22.5倍，处于近5年估值中枢下方。营收增长稳健（YoY +12%），毛利率维持在52%高位。现金流充裕，经营质量良好。' },
                    { title: '资金面分析', content: '近5日主力资金净流入2.35亿，北向资金持续增持。大单买入占比提升至62%，筹码集中度改善。龙虎榜显示知名机构席位净买入。' },
                    { title: '综合评分', content: '88/100 分 — 技术面 85 · 基本面 82 · 资金面 90 · 情绪面 88' },
                    { title: '操作建议', content: '短线：逢回调至375-380区间可考虑低吸，目标400，止损370。中线：当前估值合理，基本面稳健，适合分批建仓，目标420-450区间。' },
                  ].map((section) => (
                    <div key={section.title}>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 4, color: 'var(--color-accent)' }}>
                        {section.title}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        {section.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="btn btn-sm">导出 PDF</button>
                  <button className="btn btn-sm">分享报告</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recommend' && (
          <div>
            <div className="flex gap-2 mb-4">
              {['全部', '短线博弈', '中线稳健', '长线价值'].map((s) => (
                <button key={s} className="btn btn-sm">{s}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gap: '16px' }}>
              {aiRecommendations.map((rec) => (
                <div key={rec.symbol} className="card">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-accent)' }}>{rec.symbol}</span>
                      <span style={{ fontSize: '14px' }}>{rec.name}</span>
                      <span className="badge" style={{
                        background: rec.score >= 85 ? 'var(--color-up-bg)' : 'var(--color-warning)',
                        color: rec.score >= 85 ? 'var(--color-up)' : '#fff',
                      }}>
                        {rec.score}分
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{rec.style}</span>
                      <span className="badge" style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}>风险: {rec.risk}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
                    <strong>推荐理由：</strong>{rec.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'risk' && (
          <div>
            <div className="dashboard-grid fixed-3col mb-4">
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>综合风险评分</div>
                <div className="stat-value" style={{ color: 'var(--color-warning)', marginTop: 8 }}>42/100</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4 }}>中等偏低</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>风险雷达</div>
                <div style={{ fontSize: '12px', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {['市场风险: 中', '财务风险: 低', '事件风险: 低', '流动性风险: 中低'].map((r) => (
                    <div key={r} className="flex justify-between" style={{ padding: '0 16px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{r.split(':')[0]}</span>
                      <span>{r.split(':')[1].trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>关注个股</div>
                <div style={{ fontSize: '24px', fontWeight: 700, marginTop: 8 }}>2</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4 }}>只高风险标的</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title mb-4">风险个股清单</div>
              {riskAlerts.map((r) => (
                <div key={r.symbol} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex gap-3 items-center mb-2">
                    <span style={{ fontWeight: 600, color: 'var(--color-accent)', fontSize: '14px' }}>{r.symbol} {r.name}</span>
                    <span className={`badge ${r.level === 'high' ? 'badge-down' : ''}`}
                      style={r.level === 'medium' ? { background: 'var(--color-warning)', color: '#fff' } : {}}>
                      {r.level === 'high' ? '高风险' : '中风险'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.risk}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'predict' && (
          <div>
            <div className="card mb-4">
              <div className="card-title mb-4">AI 走势研判 — 00700 Tencent</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 8 }}>短期预测 (1-5日)</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-up)' }}>偏多 ↑</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 4 }}>置信度: 72%</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                    技术面MACD金叉确认，成交量温和放大，短期有望挑战390-400压力区间。
                    北向资金连续3日净买入，资金面支撑较强。
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 8 }}>中期预测 (1-3月)</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-up)' }}>震荡向上 ↗</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 4 }}>置信度: 65%</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                    基本面Q1财报超预期提供估值支撑，游戏版号常态化+广告复苏是主要催化剂。
                    但需关注港股市场整体流动性波动风险。中期目标区间: 420-450。
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title mb-4">多空信号评分</div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: 8 }}>看空</div>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-down-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-down)', fontWeight: 700 }}>25</div>
                </div>
                <div style={{ flex: 1, height: 12, background: 'linear-gradient(90deg, var(--color-down), var(--color-warning), var(--color-up))', borderRadius: 6, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '72%', top: -4, width: 20, height: 20, background: '#fff', borderRadius: '50%', border: '3px solid var(--color-accent)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: 8 }}>看多</div>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-up-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-up)', fontWeight: 700 }}>72</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 600, color: 'var(--color-up)', marginTop: 8 }}>
                综合评分: 72/100 — 建议关注
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
