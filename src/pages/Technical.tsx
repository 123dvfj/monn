import { useState, useEffect } from 'react';
import { useQuotes } from '../hooks/useStockData';
import { useStore } from '../stores/useStore';
import StockSelector from '../components/StockSelector';

const indicators = [
  { name: 'MA', fullName: '移动平均线', category: '趋势' },
  { name: 'EMA', fullName: '指数移动平均线', category: '趋势' },
  { name: 'MACD', fullName: '异同移动平均线', category: '趋势' },
  { name: 'BOLL', fullName: '布林带', category: '趋势' },
  { name: 'SAR', fullName: '抛物线指标', category: '趋势' },
  { name: 'RSI', fullName: '相对强弱指标', category: '摆动' },
  { name: 'KDJ', fullName: '随机指标', category: '摆动' },
  { name: 'WR', fullName: '威廉指标', category: '摆动' },
  { name: 'CCI', fullName: '商品通道指数', category: '摆动' },
  { name: 'OBV', fullName: '能量潮', category: '量价' },
  { name: 'VWAP', fullName: '成交量加权均价', category: '量价' },
  { name: 'ATR', fullName: '真实波幅', category: '其他' },
  { name: 'DMI', fullName: '趋向指标', category: '其他' },
  { name: 'BBI', fullName: '多空均线', category: '均线' },
];

const patterns = [
  { name: '锤子线', type: 'bullish', desc: '底部反转信号，实体小下影线长' },
  { name: '上吊线', type: 'bearish', desc: '顶部反转信号，实体小下影线长' },
  { name: '十字星', type: 'neutral', desc: '多空均衡，需结合位置判断' },
  { name: '吞没形态', type: 'reversal', desc: '第二根K线完全吞没前一根' },
  { name: '晨星', type: 'bullish', desc: '三根K线构成的底部反转形态' },
  { name: '黄昏星', type: 'bearish', desc: '三根K线构成的顶部反转形态' },
  { name: '三只乌鸦', type: 'bearish', desc: '三根连续阴线，强烈看跌' },
  { name: '头肩顶', type: 'bearish', desc: '经典顶部反转形态' },
  { name: '双底(W底)', type: 'bullish', desc: '两次探底不破，确认支撑' },
  { name: '上升三角形', type: 'bullish', desc: '水平阻力+上升支撑，看涨持续' },
];

const drawingTools = ['趋势线', '水平线', '通道线', '斐波那契回调', '斐波那契扩展', '矩形框', '文字标注'];

export default function Technical() {
  const storeSymbol = useStore((s) => s.selectedStockSymbol);
  const setSelectedStockSymbol = useStore((s) => s.setSelectedStockSymbol);
  const [symbol, setSymbol] = useState(storeSymbol);

  useEffect(() => {
    if (storeSymbol && storeSymbol !== symbol) {
      setSymbol(storeSymbol);
    }
  }, [storeSymbol]);

  const handleSelectStock = (sym: string) => {
    setSymbol(sym);
    setSelectedStockSymbol(sym);
  };

  const { quotes } = useQuotes([symbol], 60_000);
  const q = quotes.find((x) => x.symbol === symbol);
  const price = q?.regularMarketPrice ?? 0;
  const chgPct = q?.regularMarketChangePercent ?? 0;

  const [activeTab, setActiveTab] = useState('indicators');
  const [selectedCategory, setSelectedCategory] = useState('全部');

  const categories = ['全部', ...new Set(indicators.map((i) => i.category))];
  const filteredIndicators = selectedCategory === '全部'
    ? indicators
    : indicators.filter((i) => i.category === selectedCategory);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">技术分析</h1>
        <p className="page-desc">技术指标 · K线形态识别 · 画线工具 · 自定义公式</p>
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        {/* Stock Selector */}
        <div className="card mb-4" style={{ padding: '12px 16px' }}>
          <StockSelector
            value={symbol}
            onChange={handleSelectStock}
            priceLabel={q ? (
              <>
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{q.shortName ?? ''}</span>
                <span style={{ marginLeft: 12 }}>{price.toFixed(2)}</span>
                <span className={chgPct >= 0 ? 'color-up' : 'color-down'} style={{ fontSize: '13px', marginLeft: 8 }}>
                  {chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%
                </span>
              </>
            ) : undefined}
          />
        </div>

        <div className="tabs mb-4" style={{ display: 'inline-flex' }}>
          {['indicators', 'patterns', 'drawing', 'custom'].map((tab) => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {{ indicators: '技术指标', patterns: 'K线形态', drawing: '画线工具', custom: '自定义公式' }[tab]}
            </button>
          ))}
        </div>

        {activeTab === 'indicators' && (
          <div>
            <div className="flex gap-2 mb-4">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="dashboard-grid fixed-3col">
              {filteredIndicators.map((ind) => (
                <div key={ind.name} className="card" style={{ cursor: 'pointer' }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '16px' }}>{ind.name}</span>
                      <span className="badge" style={{ marginLeft: 8, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{ind.category}</span>
                    </div>
                    <button className="btn btn-sm">添加</button>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 8 }}>{ind.fullName}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="dashboard-grid fixed-3col">
            {patterns.map((p) => (
              <div key={p.name} className="card">
                <div className="flex justify-between items-center">
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span className={`badge ${p.type === 'bullish' ? 'badge-up' : p.type === 'bearish' ? 'badge-down' : ''}`}
                    style={p.type === 'neutral' || p.type === 'reversal' ? { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' } : {}}>
                    {{ bullish: '看涨', bearish: '看跌', neutral: '中性', reversal: '反转' }[p.type]}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 8 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'drawing' && (
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {drawingTools.map((tool) => (
                <button key={tool} className="btn" style={{ padding: '16px', justifyContent: 'center' }}>
                  {tool}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: '13px', color: 'var(--text-tertiary)' }}>
              提示：选择画线工具后，在 K 线图上点击即可开始绘制
            </div>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="card">
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <span style={{ color: 'var(--color-purple)' }}>indicator</span>{' '}
              <span style={{ color: 'var(--color-accent)' }}>MyCustom</span>() {'{'}<br />
              {'  '}<span style={{ color: 'var(--text-tertiary)' }}>// 自定义指标公式编辑器（类 Pine Script）</span><br />
              {'  '}ma5 = <span style={{ color: 'var(--color-green)' }}>sma</span>(close, <span style={{ color: 'var(--color-orange)' }}>5</span>)<br />
              {'  '}ma20 = <span style={{ color: 'var(--color-green)' }}>sma</span>(close, <span style={{ color: 'var(--color-orange)' }}>20</span>)<br />
              {'  '}<span style={{ color: 'var(--color-purple)' }}>plot</span>(ma5, <span style={{ color: 'var(--color-green)' }}>"MA5"</span>, color.blue)<br />
              {'  '}<span style={{ color: 'var(--color-purple)' }}>plot</span>(ma20, <span style={{ color: 'var(--color-green)' }}>"MA20"</span>, color.orange)<br />
              {'}'}
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-primary">编译并预览</button>
              <button className="btn">加载示例</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
