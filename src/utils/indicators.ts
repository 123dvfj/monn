import type { YCandle } from '../services/yahooFinance';

export interface IndicatorResult {
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma60: number | null;
  ema12: number | null;
  ema26: number | null;
  macd: { dif: number; dea: number; histogram: number } | null;
  rsi14: number | null;
  boll: { upper: number; middle: number; lower: number; width: number } | null;
  kdj: { k: number; d: number; j: number } | null;
  atr14: number | null;
  signals: IndicatorSignal[];
}

export interface IndicatorSignal {
  type: 'bullish' | 'bearish' | 'neutral';
  indicator: string;
  message: string;
  strength: 'strong' | 'moderate' | 'weak';
}

function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result.push(+(sum / period).toFixed(4));
  }
  return result;
}

function ema(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  // Seed with SMA for first value
  let prev: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (prev === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
      prev = sum / period;
    } else {
      prev = (data[i] - prev) * multiplier + prev;
    }
    result.push(+(prev).toFixed(4));
  }
  return result;
}

function rsi(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i < period) {
      avgGain += gain;
      avgLoss += loss;
      if (i < period - 1) { result.push(null); continue; }
      avgGain /= period;
      avgLoss /= period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(+(100 - 100 / (1 + rs)).toFixed(2));
  }
  return result;
}

function bollinger(data: number[], period: number = 20, multiplier: number = 2) {
  const middle = sma(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    const m = middle[i];
    if (m === null) { upper.push(null); lower.push(null); continue; }
    let sumSq = 0, count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (data[j] - m) ** 2;
      count++;
    }
    const std = Math.sqrt(sumSq / count);
    upper.push(+(m + multiplier * std).toFixed(4));
    lower.push(+(m - multiplier * std).toFixed(4));
  }
  return { upper, middle, lower };
}

function kdj(highs: number[], lows: number[], closes: number[], period: number = 9) {
  const k: (number | null)[] = [];
  const d: (number | null)[] = [];
  const j: (number | null)[] = [];
  let prevK = 50, prevD = 50;

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { k.push(null); d.push(null); j.push(null); continue; }
    const sliceHigh = highs.slice(i - period + 1, i + 1);
    const sliceLow = lows.slice(i - period + 1, i + 1);
    const hh = Math.max(...sliceHigh);
    const ll = Math.min(...sliceLow);
    const rsv = ll === hh ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;

    if (i === period - 1) {
      prevK = (2 / 3) * prevK + (1 / 3) * rsv;
      prevD = (2 / 3) * prevD + (1 / 3) * prevK;
    } else {
      prevK = (2 / 3) * prevK + (1 / 3) * rsv;
      prevD = (2 / 3) * prevD + (1 / 3) * prevK;
    }
    const curJ = 3 * prevK - 2 * prevD;
    k.push(+prevK.toFixed(2));
    d.push(+prevD.toFixed(2));
    j.push(+curJ.toFixed(2));
  }
  return { k, d, j };
}

function atr(highs: number[], lows: number[], closes: number[], period: number = 14): (number | null)[] {
  const tr: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    ));
  }
  const result: (number | null)[] = [null];
  let atrVal = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (i === period - 1) {
      result.push(+atrVal.toFixed(4));
    } else {
      atrVal = (atrVal * (period - 1) + tr[i]) / period;
      result.push(+atrVal.toFixed(4));
    }
  }
  return result;
}

export function computeIndicators(candles: YCandle[]): IndicatorResult {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const last = (arr: (number | null)[]) => arr.length > 0 ? arr[arr.length - 1] : null;

  const ma5Series = sma(closes, 5);
  const ma10Series = sma(closes, 10);
  const ma20Series = sma(closes, 20);
  const ma60Series = sma(closes, 60);
  const ema12Series = ema(closes, 12);
  const ema26Series = ema(closes, 26);
  const rsiSeries = rsi(closes, 14);
  const bollSeries = bollinger(closes, 20);
  const kdjSeries = kdj(highs, lows, closes, 9);
  const atrSeries = atr(highs, lows, closes, 14);

  // MACD from EMA12/EMA26
  const dif: (number | null)[] = [];
  const deaSignal: (number | null)[] = [];
  const macdHist: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12Series[i] == null || ema26Series[i] == null) {
      dif.push(null); deaSignal.push(null); macdHist.push(null); continue;
    }
    dif.push(+(ema12Series[i]! - ema26Series[i]!).toFixed(4));
  }
  // DEA = 9-period EMA of DIF
  const validDifs = dif.filter((v): v is number => v !== null);
  const deaRaw = ema(validDifs, 9);
  let deaI = 0;
  for (let i = 0; i < dif.length; i++) {
    if (dif[i] === null || deaRaw[deaI] === null) {
      deaSignal.push(null); macdHist.push(null);
    } else {
      deaSignal.push(deaRaw[deaI]);
      macdHist.push(+((dif[i]! - deaRaw[deaI]!) * 2).toFixed(4));
      deaI++;
    }
  }

  // Signals
  const signals: IndicatorSignal[] = [];
  const ma5 = last(ma5Series);
  const ma10 = last(ma10Series);
  const ma20 = last(ma20Series);
  const ma60 = last(ma60Series);
  const rsiVal = last(rsiSeries);
  const kdjK = last(kdjSeries.k);
  const kdjD = last(kdjSeries.d);
  const kdjJ = last(kdjSeries.j);
  const bollU = last(bollSeries.upper);
  const bollM = last(bollSeries.middle);
  const bollL = last(bollSeries.lower);
  const curPrice = closes.length > 0 ? closes[closes.length - 1] : 0;

  // MA signals
  if (ma5 != null && ma10 != null) {
    if (ma5 > ma10) signals.push({ type: 'bullish', indicator: 'MA', message: `MA5(${ma5.toFixed(2)}) > MA10(${ma10.toFixed(2)}) 金叉持有中`, strength: 'moderate' });
    else signals.push({ type: 'bearish', indicator: 'MA', message: `MA5(${ma5.toFixed(2)}) < MA10(${ma10.toFixed(2)}) 死叉状态`, strength: 'moderate' });
  }
  if (ma20 != null && ma60 != null) {
    if (ma20 > ma60) signals.push({ type: 'bullish', indicator: 'MA', message: 'MA20 > MA60 中期趋势向上', strength: 'strong' });
    else signals.push({ type: 'bearish', indicator: 'MA', message: 'MA20 < MA60 中期趋势向下', strength: 'strong' });
  }
  if (curPrice > 0 && ma20 != null) {
    if (curPrice > ma20) signals.push({ type: 'bullish', indicator: 'MA', message: `价格(${curPrice.toFixed(2)})站上 MA20(${ma20.toFixed(2)})`, strength: 'moderate' });
    else signals.push({ type: 'bearish', indicator: 'MA', message: `价格(${curPrice.toFixed(2)})跌破 MA20(${ma20.toFixed(2)})`, strength: 'moderate' });
  }

  // MACD signals
  const difLast = last(dif);
  const deaLast = last(deaSignal);
  const histLast = last(macdHist);
  if (difLast != null && deaLast != null && histLast != null) {
    if (histLast > 0) signals.push({ type: 'bullish', indicator: 'MACD', message: `红柱(${histLast.toFixed(4)}) DIF > DEA`, strength: 'moderate' });
    else signals.push({ type: 'bearish', indicator: 'MACD', message: `绿柱(${histLast.toFixed(4)}) DIF < DEA`, strength: 'moderate' });
    if (difLast > 0) signals.push({ type: 'bullish', indicator: 'MACD', message: 'DIF > 0 多头市场', strength: 'strong' });
    else signals.push({ type: 'bearish', indicator: 'MACD', message: 'DIF < 0 空头市场', strength: 'strong' });
  }

  // RSI signals
  if (rsiVal != null) {
    if (rsiVal > 80) signals.push({ type: 'bearish', indicator: 'RSI', message: `RSI(${rsiVal}) 极度超买，注意回调风险`, strength: 'strong' });
    else if (rsiVal > 70) signals.push({ type: 'bearish', indicator: 'RSI', message: `RSI(${rsiVal}) 超买区域`, strength: 'moderate' });
    else if (rsiVal < 20) signals.push({ type: 'bullish', indicator: 'RSI', message: `RSI(${rsiVal}) 极度超卖，有望反弹`, strength: 'strong' });
    else if (rsiVal < 30) signals.push({ type: 'bullish', indicator: 'RSI', message: `RSI(${rsiVal}) 超卖区域`, strength: 'moderate' });
    else signals.push({ type: 'neutral', indicator: 'RSI', message: `RSI(${rsiVal}) 正常区间`, strength: 'weak' });
  }

  // BOLL signals
  if (bollU != null && bollL != null && bollM != null && curPrice > 0) {
    const width = ((bollU - bollL) / bollM) * 100;
    if (curPrice > bollU * 0.98) signals.push({ type: 'bearish', indicator: 'BOLL', message: `价格接近上轨(${bollU.toFixed(2)}) 有回调压力`, strength: 'moderate' });
    else if (curPrice < bollL * 1.02) signals.push({ type: 'bullish', indicator: 'BOLL', message: `价格接近下轨(${bollL.toFixed(2)}) 有反弹动力`, strength: 'moderate' });
    if (width < 5) signals.push({ type: 'neutral', indicator: 'BOLL', message: `布林带收窄(${width.toFixed(1)}%) 即将变盘`, strength: 'strong' });
  }

  // KDJ signals
  if (kdjK != null && kdjD != null && kdjJ != null) {
    if (kdjJ > 100) signals.push({ type: 'bearish', indicator: 'KDJ', message: `J值(${kdjJ})>100 超买`, strength: 'moderate' });
    else if (kdjJ < 0) signals.push({ type: 'bullish', indicator: 'KDJ', message: `J值(${kdjJ})<0 超卖`, strength: 'moderate' });
    if (kdjK > kdjD) signals.push({ type: 'bullish', indicator: 'KDJ', message: 'K > D 金叉持有', strength: 'moderate' });
    else signals.push({ type: 'bearish', indicator: 'KDJ', message: 'K < D 死叉状态', strength: 'moderate' });
  }

  return {
    ma5, ma10, ma20, ma60,
    ema12: last(ema12Series),
    ema26: last(ema26Series),
    macd: difLast != null && deaLast != null && histLast != null
      ? { dif: difLast, dea: deaLast, histogram: histLast } : null,
    rsi14: rsiVal,
    boll: bollU != null && bollM != null && bollL != null
      ? { upper: bollU, middle: bollM, lower: bollL, width: +(((bollU - bollL) / bollM) * 100).toFixed(1) }
      : null,
    kdj: kdjK != null && kdjD != null && kdjJ != null
      ? { k: kdjK, d: kdjD, j: kdjJ } : null,
    atr14: last(atrSeries),
    signals,
  };
}

export const INDICATOR_PERIODS = [
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '3M', range: '3mo', interval: '1d' },
  { label: '6M', range: '6mo', interval: '1d' },
  { label: '1Y', range: '1y', interval: '1d' },
] as const;
