import type { Stock } from '../stores/useStore';

export interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export const indexData: IndexData[] = [
  { symbol: 'HSI', name: '恒生指数', price: 19230.50, change: 125.30, changePercent: 0.66 },
  { symbol: 'HSCEI', name: '国企指数', price: 6520.12, change: 38.45, changePercent: 0.59 },
  { symbol: 'HSTECH', name: '恒生科技', price: 3980.75, change: -12.30, changePercent: -0.31 },
  { symbol: 'DJI', name: '道琼斯', price: 38996.40, change: 210.30, changePercent: 0.54 },
  { symbol: 'IXIC', name: '纳斯达克', price: 17250.80, change: 85.60, changePercent: 0.50 },
  { symbol: 'SPX', name: '标普500', price: 5320.15, change: 28.40, changePercent: 0.54 },
];

export const hotStocks: Stock[] = [
  { symbol: '00700', name: 'Tencent', market: 'HK', price: 385.20, change: 5.80, changePercent: 1.53, volume: 24500000, high: 387.60, low: 379.10, open: 380.00, prevClose: 379.40, marketCap: 3650000000000, pe: 22.5 },
  { symbol: '09988', name: 'BABA-SW', market: 'HK', price: 78.50, change: -1.20, changePercent: -1.51, volume: 32000000, high: 80.10, low: 78.10, open: 79.80, prevClose: 79.70, marketCap: 1580000000000, pe: 18.2 },
  { symbol: '01810', name: 'Xiaomi-W', market: 'HK', price: 18.62, change: 0.42, changePercent: 2.31, volume: 52000000, high: 18.90, low: 18.20, open: 18.25, prevClose: 18.20, marketCap: 465000000000, pe: 28.5 },
  { symbol: '00388', name: 'HKEX', market: 'HK', price: 285.40, change: 3.20, changePercent: 1.13, volume: 5800000, high: 286.80, low: 282.00, open: 282.50, prevClose: 282.20, marketCap: 362000000000, pe: 32.1 },
  { symbol: '09618', name: 'JD-SW', market: 'HK', price: 128.30, change: -2.50, changePercent: -1.91, volume: 9800000, high: 131.20, low: 127.80, open: 130.80, prevClose: 130.80, marketCap: 410000000000, pe: 15.8 },
  { symbol: 'AAPL', name: 'Apple Inc', market: 'US', price: 189.85, change: 2.35, changePercent: 1.25, volume: 48000000, high: 190.50, low: 187.20, open: 187.80, prevClose: 187.50, marketCap: 2920000000000, pe: 31.2 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', market: 'US', price: 925.40, change: 15.30, changePercent: 1.68, volume: 35000000, high: 930.00, low: 908.00, open: 912.00, prevClose: 910.10, marketCap: 2280000000000, pe: 72.5 },
  { symbol: 'MSFT', name: 'Microsoft Corp', market: 'US', price: 430.25, change: -3.15, changePercent: -0.73, volume: 22000000, high: 434.00, low: 428.50, open: 433.60, prevClose: 433.40, marketCap: 3200000000000, pe: 38.1 },
  { symbol: 'TSLA', name: 'Tesla Inc', market: 'US', price: 182.30, change: 4.50, changePercent: 2.53, volume: 65000000, high: 184.20, low: 178.00, open: 178.50, prevClose: 177.80, marketCap: 580000000000, pe: 52.0 },
  { symbol: 'GOOGL', name: 'Alphabet Inc', market: 'US', price: 175.80, change: 1.10, changePercent: 0.63, volume: 18000000, high: 176.50, low: 174.20, open: 174.80, prevClose: 174.70, marketCap: 2180000000000, pe: 27.8 },
];

export const sectorData = [
  { name: '科技', changePercent: 2.35, leadingStock: '00700' },
  { name: '医药', changePercent: 1.20, leadingStock: '02269' },
  { name: '金融', changePercent: 0.85, leadingStock: '00388' },
  { name: '消费', changePercent: -0.42, leadingStock: '09618' },
  { name: '地产', changePercent: -1.15, leadingStock: '00016' },
  { name: '新能源', changePercent: 3.10, leadingStock: '01211' },
];

export function getStockPrice(symbol: string): number {
  const stock = hotStocks.find((s) => s.symbol === symbol);
  return stock?.price ?? 0;
}

export function getStockInfo(symbol: string): Stock | undefined {
  return hotStocks.find((s) => s.symbol === symbol);
}

// Generate K-line compatible mock candlestick data for lightweight-charts
export function generateCandles(days: number = 180) {
  const candles = [];
  let price = 370;
  const now = new Date('2024-07-01');
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    // skip weekends roughly
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const volatility = price * 0.02;
    const open = price + (Math.random() - 0.5) * volatility;
    const close = open + (Math.random() - 0.48) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = 10000000 + Math.random() * 30000000;

    candles.push({
      time: date.toISOString().split('T')[0],
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(volume),
    });
    price = close;
  }
  return candles;
}

export const newsItems = [
  { id: '1', title: 'Tencent 发布 Q1 财报，营收超预期 12%', symbol: '00700', sentiment: 'positive', time: '2小时前', source: '财联社' },
  { id: '2', title: 'NVIDIA 股价再创新高，AI 芯片需求持续旺盛', symbol: 'NVDA', sentiment: 'positive', time: '3小时前', source: 'Bloomberg' },
  { id: '3', title: 'HKEX 宣布推出新上市规则，降低科技公司门槛', symbol: '00388', sentiment: 'neutral', time: '4小时前', source: '港交所' },
  { id: '4', title: '美联储维持利率不变，市场反应平淡', symbol: '', sentiment: 'neutral', time: '5小时前', source: 'Reuters' },
  { id: '5', title: 'Tesla 中国区销量下滑，面临本土品牌竞争压力', symbol: 'TSLA', sentiment: 'negative', time: '6小时前', source: '36氪' },
  { id: '6', title: '小米汽车 SU7 交付量突破 10 万台', symbol: '01810', sentiment: 'positive', time: '7小时前', source: '证券时报' },
];

export const announcements = [
  { date: '2024-05-20', title: '2024年第一季度业绩公告', symbol: '00700', type: '财报' },
  { date: '2024-05-18', title: '董事会召开日期', symbol: '00700', type: '会议' },
  { date: '2024-05-15', title: '股份购回报告', symbol: '00700', type: '回购' },
];

export const financialData = {
  revenue: [4820, 5545, 5601, 6090, 6500], // in hundred million HKD
  netProfit: [933, 1150, 1880, 1156, 1576],
  years: ['2020', '2021', '2022', '2023', '2024Q1'],
  pe: { current: 22.5, high_5y: 45, low_5y: 12, median_5y: 28 },
  pb: { current: 4.2, high_5y: 8.5, low_5y: 2.8, median_5y: 5.1 },
  roe: 18.5,
  roa: 8.2,
  grossMargin: 52.3,
  netMargin: 24.1,
  debtRatio: 35.8,
};

export const capitalFlow = {
  mainInflow: 2.35, // 亿
  mainOutflow: 1.85,
  bigOrderBuy: 8500, // 手
  bigOrderSell: 6200,
  northBound: 1.25, // 北向净流入(亿)
};

export const chipDistribution = [
  { price: 370, volume: 120000 },
  { price: 375, volume: 95000 },
  { price: 380, volume: 80000 },
  { price: 385, volume: 65000 },
  { price: 390, volume: 50000 },
  { price: 395, volume: 40000 },
  { price: 400, volume: 35000 },
  { price: 405, volume: 45000 },
  { price: 410, volume: 55000 },
  { price: 415, volume: 70000 },
];
