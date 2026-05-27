import type { YQuote } from '../services/yahooFinance';

// ═══════════════════════════════════════════════════════
//  RATING THRESHOLDS (from skill-financial-analyst)
// ═══════════════════════════════════════════════════════

export type Rating = 'STRONG BUY' | 'BUY' | 'WATCH·HOLD' | 'HOLD' | 'SELL';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export function scoreToRating(score: number): Rating {
  if (score >= 8.0) return 'STRONG BUY';
  if (score >= 6.5) return 'BUY';
  if (score >= 5.0) return 'WATCH·HOLD';
  if (score >= 3.5) return 'HOLD';
  return 'SELL';
}

export function scoreToConfidence(factorScores: number[]): Confidence {
  if (factorScores.length === 0) return 'LOW';
  const nonDefault = factorScores.filter((s) => Math.abs(s - 5.0) > 0.1).length;
  const ratio = nonDefault / factorScores.length;
  if (ratio >= 0.7) return 'HIGH';
  if (ratio >= 0.4) return 'MEDIUM';
  return 'LOW';
}

// ═══════════════════════════════════════════════════════
//  FUNDAMENTAL SCORE (40% weight, 10 factors)
// ═══════════════════════════════════════════════════════

interface FundScoreDetail {
  score: number;
  factorScores: number[];
  details: Record<string, { value: number | null; score: number; ratingNote: string }>;
}

function scoreFundamental(q: YQuote): FundScoreDetail {
  const scores: number[] = [];
  const details: Record<string, { value: number | null; score: number; ratingNote: string }> = {};

  // 1. PE Ratio
  const pe = q.trailingPE;
  if (pe != null && pe !== 0) {
    let s: number, rn: string;
    if (pe < 0) { s = 3; rn = '亏损 — 公司暂未盈利'; }
    else if (pe < 10) { s = 9; rn = '深度价值 — 远低于市场均值'; }
    else if (pe < 15) { s = 8; rn = '低估值 — 低于市场平均水平(~20x)'; }
    else if (pe < 20) { s = 7; rn = '合理估值 — 接近市场平均水平'; }
    else if (pe < 25) { s = 6; rn = '略偏高 — 高于均值但在合理范围'; }
    else if (pe < 30) { s = 5; rn = '偏高 — 溢价估值'; }
    else if (pe < 40) { s = 4; rn = '昂贵 — 高增长预期已计入价格'; }
    else if (pe < 60) { s = 3; rn = '非常贵 — 显著下行风险'; }
    else { s = 2; rn = '极贵 — 投机性估值'; }
    scores.push(s);
    details['PE(TTM)'] = { value: pe, score: s, ratingNote: rn };
  } else {
    scores.push(5);
    details['PE(TTM)'] = { value: null, score: 5, ratingNote: '无 PE 数据' };
  }

  // 2. Market Cap (proxy for stability)
  const cap = q.marketCap ?? 0;
  if (cap > 0) {
    let s: number, rn: string;
    if (cap > 1e12) { s = 9; rn = '超大盘 — 极高稳定性'; }
    else if (cap > 5e11) { s = 8; rn = '大盘股 — 高流动性'; }
    else if (cap > 1e11) { s = 7; rn = '中大盘 — 流动性好'; }
    else if (cap > 5e10) { s = 6; rn = '中盘股 — 流动性适中'; }
    else if (cap > 1e10) { s = 5; rn = '中小盘 — 成长空间大'; }
    else { s = 4; rn = '小盘股 — 波动性较高'; }
    scores.push(s);
    details['市值规模'] = { value: cap / 1e8, score: s, ratingNote: rn };
  } else {
    scores.push(5);
    details['市值规模'] = { value: null, score: 5, ratingNote: '无市值数据' };
  }

  // 3. Forward PE (outlook)
  const fwdPE = q.forwardPE;
  if (fwdPE != null && fwdPE > 0) {
    let s: number, rn: string;
    if (fwdPE < pe!) { s = 8; rn = '预期盈利增长 — 前瞻PE低于当前'; }
    else if (fwdPE < pe! * 1.1) { s = 6; rn = '预期稳定 — 前瞻PE与当前持平'; }
    else { s = 4; rn = '预期盈利下降 — 前瞻PE高于当前'; }
    scores.push(s);
    details['前瞻PE'] = { value: fwdPE, score: s, ratingNote: rn };
  } else {
    scores.push(5);
    details['前瞻PE'] = { value: null, score: 5, ratingNote: '无前瞻数据' };
  }

  // 4. 52-Week Position (momentum/value context)
  const high52 = q.fiftyTwoWeekHigh ?? 0;
  const low52 = q.fiftyTwoWeekLow ?? 0;
  const price = q.regularMarketPrice ?? 0;
  if (high52 > 0 && low52 > 0 && price > 0) {
    const pos = ((price - low52) / (high52 - low52)) * 100;
    let s: number, rn: string;
    if (pos < 20) { s = 8; rn = `接近52周低位(${pos.toFixed(0)}%分位) — 潜在反弹机会`; }
    else if (pos < 40) { s = 7; rn = `偏低区间(${pos.toFixed(0)}%分位) — 有上行空间`; }
    else if (pos < 60) { s = 6; rn = `中间区域(${pos.toFixed(0)}%分位) — 多空均衡`; }
    else if (pos < 80) { s = 5; rn = `偏高水平(${pos.toFixed(0)}%分位) — 接近高位`; }
    else { s = 3; rn = `接近52周高位(${pos.toFixed(0)}%分位) — 短期追高风险`; }
    scores.push(s);
    details['52周位置'] = { value: pos, score: s, ratingNote: rn };
  } else {
    scores.push(5);
    details['52周位置'] = { value: null, score: 5, ratingNote: '无52周数据' };
  }

  // 5. Volume vs Average (market attention)
  const vol = q.regularMarketVolume ?? 0;
  const avgVol = q.averageDailyVolume3Month ?? 0;
  if (vol > 0 && avgVol > 0) {
    const ratio = vol / avgVol;
    let s: number, rn: string;
    if (ratio > 2) { s = 7; rn = `成交量激增(${ratio.toFixed(1)}x) — 市场高度关注`; }
    else if (ratio > 1.3) { s = 7; rn = `温和放量(${ratio.toFixed(1)}x) — 交投活跃`; }
    else if (ratio > 0.7) { s = 5; rn = `正常交投(${ratio.toFixed(1)}x)`; }
    else { s = 3; rn = `交投清淡(${ratio.toFixed(1)}x) — 市场关注度低`; }
    scores.push(s);
    details['成交量'] = { value: ratio, score: s, ratingNote: rn };
  }

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { score: Math.round(avg * 10) / 10, factorScores: scores, details };
}

// ═══════════════════════════════════════════════════════
//  TECHNICAL SCORE (30% weight, 6 factors)
// ═══════════════════════════════════════════════════════

interface TechScoreDetail {
  score: number;
  factorScores: number[];
  details: Record<string, { value: number | null; score: number; ratingNote: string }>;
}

function scoreTechnical(q: YQuote): TechScoreDetail {
  const scores: number[] = [];
  const details: Record<string, { value: number | null; score: number; ratingNote: string }> = {};

  // 1. Price vs 50-day MA (proxy via 52-week position + short-term change)
  const changePct = q.regularMarketChangePercent ?? 0;
  if (changePct !== 0) {
    let s: number, rn: string;
    if (changePct > 5) { s = 9; rn = '强势突破 — 日内涨幅显著'; }
    else if (changePct > 2) { s = 8; rn = '短期强势 — 动能向上'; }
    else if (changePct > 0.5) { s = 6; rn = '温和上涨 — 趋势偏多'; }
    else if (changePct > -0.5) { s = 5; rn = '价格平稳 — 横盘整理'; }
    else if (changePct > -2) { s = 4; rn = '温和下跌 — 趋势偏空'; }
    else if (changePct > -5) { s = 3; rn = '短期弱势 — 动能向下'; }
    else { s = 2; rn = '大幅下跌 — 短期承压严重'; }
    scores.push(s);
    details['日内动量'] = { value: changePct, score: s, ratingNote: rn };
  } else {
    scores.push(5);
    details['日内动量'] = { value: null, score: 5, ratingNote: '暂无数据' };
  }

  // 2. Day range position (intraday strength)
  const high = q.regularMarketDayHigh ?? 0;
  const low = q.regularMarketDayLow ?? 0;
  const price = q.regularMarketPrice ?? 0;
  if (high > low && price > 0) {
    const pos = ((price - low) / (high - low)) * 100;
    let s: number, rn: string;
    if (pos > 70) { s = 8; rn = `日内高位(${pos.toFixed(0)}%) — 买方主导`; }
    else if (pos > 50) { s = 6; rn = `日内偏强(${pos.toFixed(0)}%)`; }
    else if (pos > 30) { s = 5; rn = `日内中部(${pos.toFixed(0)}%)`; }
    else { s = 3; rn = `日内低位(${pos.toFixed(0)}%) — 卖方主导`; }
    scores.push(s);
    details['日内位置'] = { value: pos, score: s, ratingNote: rn };
  } else {
    scores.push(5);
    details['日内位置'] = { value: null, score: 5, ratingNote: '暂无数据' };
  }

  // 3. Bid/Ask spread (liquidity)
  if (q.bid != null && q.ask != null && price > 0) {
    const spread = ((q.ask - q.bid) / price) * 100;
    let s: number, rn: string;
    if (spread < 0.05) { s = 8; rn = `极窄价差(${spread.toFixed(2)}%) — 流动性极好`; }
    else if (spread < 0.1) { s = 7; rn = `窄价差(${spread.toFixed(2)}%) — 流动性良好`; }
    else if (spread < 0.3) { s = 5; rn = `正常价差(${spread.toFixed(2)}%)`; }
    else { s = 3; rn = `价差较大(${spread.toFixed(2)}%) — 流动性一般`; }
    scores.push(s);
    details['买卖价差'] = { value: spread, score: s, ratingNote: rn };
  } else {
    scores.push(5);
    details['买卖价差'] = { value: null, score: 5, ratingNote: '非交易时段' };
  }

  // 4. Volatility proxy (day range %)
  if (high > 0 && low > 0) {
    const rangePct = ((high - low) / low) * 100;
    let s: number, rn: string;
    if (rangePct < 1) { s = 5; rn = `极低波动(${rangePct.toFixed(2)}%) — 稳定`; }
    else if (rangePct < 3) { s = 6; rn = `正常波动(${rangePct.toFixed(2)}%) — 健康`; }
    else if (rangePct < 5) { s = 5; rn = `较高波动(${rangePct.toFixed(2)}%) — 需关注`; }
    else { s = 3; rn = `剧烈波动(${rangePct.toFixed(2)}%) — 高风险`; }
    scores.push(s);
    details['日内振幅'] = { value: rangePct, score: s, ratingNote: rn };
  } else {
    scores.push(5);
    details['日内振幅'] = { value: null, score: 5, ratingNote: '暂无数据' };
  }

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { score: Math.round(avg * 10) / 10, factorScores: scores, details };
}

// ═══════════════════════════════════════════════════════
//  SENTIMENT SCORE (30% weight, 4 factors)
// ═══════════════════════════════════════════════════════

interface SentScoreDetail {
  score: number;
  factorScores: number[];
  details: Record<string, { value: number | null; score: number; ratingNote: string }>;
}

function scoreSentiment(q: YQuote): SentScoreDetail {
  const scores: number[] = [];
  const details: Record<string, { value: number | null; score: number; ratingNote: string }> = {};

  // 1. Daily change as sentiment proxy
  const changePct = q.regularMarketChangePercent ?? 0;
  let s: number, rn: string;
  if (changePct > 3) { s = 9; rn = '市场强烈看多'; }
  else if (changePct > 1) { s = 7; rn = '市场偏乐观'; }
  else if (changePct > 0) { s = 6; rn = '轻微乐观'; }
  else if (changePct > -1) { s = 4; rn = '轻微悲观'; }
  else if (changePct > -3) { s = 3; rn = '市场偏悲观'; }
  else { s = 1; rn = '市场强烈看空'; }
  scores.push(s);
  details['价格情绪'] = { value: changePct, score: s, ratingNote: rn };

  // 2. Volume sentiment (high vol + positive = bullish conviction)
  const vol = q.regularMarketVolume ?? 0;
  const avgVol = q.averageDailyVolume3Month ?? 0;
  if (vol > 0 && avgVol > 0) {
    const ratio = vol / avgVol;
    if (ratio > 1.5 && changePct > 0) { s = 8; rn = '放量上涨 — 买方信心强'; }
    else if (ratio > 1.5 && changePct < 0) { s = 2; rn = '放量下跌 — 恐慌性抛售'; }
    else if (ratio < 0.5 && changePct > 0) { s = 5; rn = '缩量上涨 — 上涨动力不足'; }
    else if (ratio < 0.5 && changePct < 0) { s = 4; rn = '缩量下跌 — 抛压减轻'; }
    else { s = 5; rn = '量价正常'; }
    scores.push(s);
    details['量价情绪'] = { value: ratio, score: s, ratingNote: rn };
  } else {
    scores.push(5);
    details['量价情绪'] = { value: null, score: 5, ratingNote: '暂无数据' };
  }

  // 3. Market cap tier sentiment (larger = more institutional confidence)
  const cap = q.marketCap ?? 0;
  if (cap > 0) {
    if (cap > 1e12) { s = 8; rn = '超大盘 — 机构重仓标的'; }
    else if (cap > 1e11) { s = 7; rn = '大盘 — 机构关注度高'; }
    else if (cap > 5e10) { s = 6; rn = '中盘 — 成长资金关注'; }
    else { s = 5; rn = '中小盘 — 散户参与为主'; }
    scores.push(s);
    details['机构参与度'] = { value: cap / 1e8, score: s, ratingNote: rn };
  } else {
    scores.push(5);
    details['机构参与度'] = { value: null, score: 5, ratingNote: '暂无数据' };
  }

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { score: Math.round(avg * 10) / 10, factorScores: scores, details };
}

// ═══════════════════════════════════════════════════════
//  COMPOSITE SCORE (40% Fund + 30% Tech + 30% Sent)
// ═══════════════════════════════════════════════════════

export interface CompositeResult {
  symbol: string;
  name: string;
  compositeScore: number;
  rating: Rating;
  confidence: Confidence;
  fundamentalScore: number;
  technicalScore: number;
  sentimentScore: number;
  fundDetails: FundScoreDetail['details'];
  techDetails: TechScoreDetail['details'];
  sentDetails: SentScoreDetail['details'];
  entryLevels: { aggressive: number; moderate: number; conservative: number };
  exitTargets: { target1: number; target2: number; target3: number };
  stopLoss: number;
  riskReward: { t1: number; t2: number; t3: number };
  summary: string;
}

export function computeCompositeScore(q: YQuote): CompositeResult | null {
  const price = q.regularMarketPrice ?? 0;
  if (!price || price <= 0) return null;

  const fund = scoreFundamental(q);
  const tech = scoreTechnical(q);
  const sent = scoreSentiment(q);

  const composite = fund.score * 0.4 + tech.score * 0.3 + sent.score * 0.3;
  const allFactorScores = [...fund.factorScores, ...tech.factorScores, ...sent.factorScores];
  const rating = scoreToRating(composite);
  const confidence = scoreToConfidence(allFactorScores);

  // Entry/Exit calculation
  const atr = price * 0.02; // 2% ATR proxy
  const scoreMult = (composite - 5) * 0.1;

  const entries = {
    aggressive: +(price - atr * (0.5 - scoreMult * 0.3)).toFixed(2),
    moderate: +(price - atr * (1.25 - scoreMult * 0.5)).toFixed(2),
    conservative: +(price - atr * (2.25 - scoreMult * 0.8)).toFixed(2),
  };

  const targets = {
    target1: +(price + atr * (1.0 + scoreMult * 0.5)).toFixed(2),
    target2: +(price + atr * (2.5 + scoreMult * 0.8)).toFixed(2),
    target3: +(price + atr * (4.0 + scoreMult * 1.2)).toFixed(2),
  };

  const stopLoss = +(price - atr * 1.5).toFixed(2);
  const risk = price - entries.moderate;
  const rr = {
    t1: +(risk > 0 ? (targets.target1 - price) / risk : 0).toFixed(1),
    t2: +(risk > 0 ? (targets.target2 - price) / risk : 0).toFixed(1),
    t3: +(risk > 0 ? (targets.target3 - price) / risk : 0).toFixed(1),
  };

  const symbol = q.symbol ?? '';
  const name = (q.shortName ?? q.longName ?? '').slice(0, 30);

  let summary = '';
  if (composite >= 8) summary = '综合评分优秀，基本面+技术面+情绪面共振向上，适合作为核心持仓。';
  else if (composite >= 6.5) summary = '综合评分良好，多维度表现均衡，可作为配置标的关注。';
  else if (composite >= 5) summary = '综合评分中等，部分维度存在分歧，建议观望等待更好时机。';
  else if (composite >= 3.5) summary = '综合评分偏低，多维度信号偏弱，建议谨慎对待。';
  else summary = '综合评分较差，多项指标亮红灯，不建议参与。';

  return {
    symbol,
    name,
    compositeScore: +composite.toFixed(1),
    rating,
    confidence,
    fundamentalScore: fund.score,
    technicalScore: tech.score,
    sentimentScore: sent.score,
    fundDetails: fund.details,
    techDetails: tech.details,
    sentDetails: sent.details,
    entryLevels: entries,
    exitTargets: targets,
    stopLoss,
    riskReward: rr,
    summary,
  };
}
