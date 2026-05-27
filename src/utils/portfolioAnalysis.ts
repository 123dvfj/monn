import type { Holding } from '../stores/portfolioStore';
import type { YQuote } from '../services/yahooFinance';

export interface PositionAnalysis {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  pnl: number;
  pnlPct: number;
  weightPct: number;
  recommendation: {
    action: 'buy' | 'hold' | 'reduce' | 'sell';
    label: string;
    color: string;
    reasons: string[];
    confidence: number;
  };
}

export interface PortfolioSummary {
  totalAssets: number;
  cashBalance: number;
  stockValue: number;
  totalPnl: number;
  totalPnlPct: number;
  positionCount: number;
}

export function analyzePortfolio(
  holdings: Holding[],
  balance: number,
  quotes: YQuote[],
): PositionAnalysis[] {
  if (holdings.length === 0) return [];

  const getPrice = (sym: string) => quotes.find((q) => q.symbol === sym)?.regularMarketPrice ?? 0;
  const getChgPct = (sym: string) => quotes.find((q) => q.symbol === sym)?.regularMarketChangePercent ?? 0;
  const getPe = (sym: string) => quotes.find((q) => q.symbol === sym)?.trailingPE ?? null;
  const getName = (sym: string) => quotes.find((q) => q.symbol === sym)?.shortName ?? sym;

  const totalStockValue = holdings.reduce((sum, h) => sum + h.shares * getPrice(h.symbol), 0);
  const totalPortfolio = balance + totalStockValue;

  return holdings.map((h) => {
    const currentPrice = getPrice(h.symbol);
    const marketValue = h.shares * currentPrice;
    const costBasis = h.shares * h.avgCost;
    const pnl = marketValue - costBasis;
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    const weightPct = totalPortfolio > 0 ? (marketValue / totalPortfolio) * 100 : 0;
    const chgPct = getChgPct(h.symbol);
    const pe = getPe(h.symbol);
    const name = getName(h.symbol);

    // Recommendation engine
    const reasons: string[] = [];
    let score = 0; // negative = sell/reduce, positive = buy/hold/buy more

    // P&L based signals
    if (pnlPct > 30) {
      reasons.push(`已盈利 ${pnlPct.toFixed(1)}%，可考虑锁定部分利润`);
      score -= 2;
    } else if (pnlPct > 15) {
      reasons.push(`盈利 ${pnlPct.toFixed(1)}%，趋势良好可继续持有`);
      score += 1;
    } else if (pnlPct > 0) {
      reasons.push(`小幅盈利 ${pnlPct.toFixed(1)}%`);
      score += 1;
    } else if (pnlPct < -20) {
      reasons.push(`亏损 ${Math.abs(pnlPct).toFixed(1)}%，深度套牢，建议评估是否止损`);
      score -= 3;
    } else if (pnlPct < -10) {
      reasons.push(`亏损 ${Math.abs(pnlPct).toFixed(1)}%，关注是否继续恶化`);
      score -= 1;
    } else if (pnlPct < 0) {
      reasons.push(`小幅亏损 ${Math.abs(pnlPct).toFixed(1)}%，暂持观察`);
    }

    // Position weight signals
    if (weightPct > 40) {
      reasons.push(`仓位占比 ${weightPct.toFixed(0)}% 过高，建议分散风险`);
      score -= 2;
    } else if (weightPct > 25) {
      reasons.push(`仓位占比 ${weightPct.toFixed(0)}% 较重，注意控制`);
      score -= 1;
    } else if (weightPct < 5 && pnlPct > 0) {
      reasons.push(`仓位占比较低(${weightPct.toFixed(0)}%)，盈利状态下可考虑加仓`);
      score += 2;
    }

    // Price momentum signal
    if (chgPct > 3) reasons.push(`今日涨 ${chgPct.toFixed(1)}%，短期强势`);
    else if (chgPct < -3) reasons.push(`今日跌 ${Math.abs(chgPct).toFixed(1)}%，短期承压`);

    // PE valuation signal
    if (pe != null && pe > 0) {
      if (pe > 100) {
        reasons.push(`PE ${pe.toFixed(0)} 极高，估值风险较大`);
        score -= 1;
      } else if (pe < 10) {
        reasons.push(`PE ${pe.toFixed(0)} 估值偏低，具有安全边际`);
        score += 1;
      }
    }

    const action: PositionAnalysis['recommendation']['action'] =
      score >= 3 ? 'buy' :
      score >= 0 ? 'hold' :
      score >= -2 ? 'reduce' : 'sell';

    const config = {
      buy:    { label: '建议加仓', color: 'var(--color-up)' },
      hold:   { label: '继续持有', color: 'var(--color-warning)' },
      reduce: { label: '建议减仓', color: '#e67e22' },
      sell:   { label: '建议清仓', color: 'var(--color-down)' },
    };

    return {
      symbol: h.symbol,
      shares: h.shares,
      avgCost: h.avgCost,
      currentPrice,
      marketValue,
      costBasis,
      pnl,
      pnlPct,
      weightPct,
      recommendation: {
        action,
        label: config[action].label,
        color: config[action].color,
        reasons: reasons.length > 0 ? reasons : ['暂无特别信号，保持观望'],
        confidence: Math.min(100, Math.abs(score) * 20 + 30),
      },
    };
  });
}

export function computeSummary(
  analyses: PositionAnalysis[],
  balance: number,
): PortfolioSummary {
  const stockValue = analyses.reduce((s, a) => s + a.marketValue, 0);
  const costBasis = analyses.reduce((s, a) => s + a.costBasis, 0);
  const totalPnl = stockValue - costBasis;
  return {
    totalAssets: balance + stockValue,
    cashBalance: balance,
    stockValue,
    totalPnl,
    totalPnlPct: costBasis > 0 ? (totalPnl / costBasis) * 100 : 0,
    positionCount: analyses.length,
  };
}
