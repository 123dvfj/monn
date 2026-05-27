export type MarketStatus = 'open' | 'closed' | 'break';

interface MarketInfo {
  status: MarketStatus;
  label: string;
  nextOpen: string;
}

// Major HK holidays (month-day format)
const HK_HOLIDAYS = new Set([
  '01-01', // New Year
  '02-10', '02-11', '02-12', // Lunar New Year (approx)
  '04-05', // Ching Ming
  '05-01', // Labour Day
  '06-10', // Dragon Boat (approx)
  '07-01', // HKSAR Day
  '09-23', // Mid-Autumn (approx)
  '10-01', // National Day
  '12-25', '12-26', // Christmas
]);

// Major US market holidays (month-day format)
const US_HOLIDAYS = new Set([
  '01-01', // New Year
  '01-20', // MLK Day (approx)
  '02-17', // Presidents Day (approx)
  '04-18', // Good Friday (approx)
  '05-26', // Memorial Day (approx)
  '06-19', // Juneteenth
  '07-04', // Independence Day
  '09-01', // Labor Day (approx)
  '11-27', // Thanksgiving (approx)
  '12-25', // Christmas
]);

function isHoliday(d: Date, tz: string): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return (tz === 'Asia/Hong_Kong' ? HK_HOLIDAYS : US_HOLIDAYS).has(`${month}-${day}`);
}

function tzInfo(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hours = parseInt(get('hour'));
  const minutes = parseInt(get('minute'));
  const weekday = get('weekday');
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);

  return { hours, minutes, dayOfWeek, totalMinutes: hours * 60 + minutes };
}

/** HK market: Mon-Fri 09:30-12:00, 13:00-16:00 HKT */
export function getHKMarketStatus(d: Date = new Date()): MarketInfo {
  const { totalMinutes, dayOfWeek } = tzInfo(d, 'Asia/Hong_Kong');
  if (dayOfWeek === 0 || dayOfWeek === 6) return { status: 'closed', label: '周末休市', nextOpen: '周一 09:30' };
  if (isHoliday(d, 'Asia/Hong_Kong')) return { status: 'closed', label: '假期休市', nextOpen: '下一交易日 09:30' };
  if (totalMinutes < 570)  return { status: 'closed', label: '盘前', nextOpen: '09:30' };
  if (totalMinutes < 720)  return { status: 'open', label: '交易中', nextOpen: '' };
  if (totalMinutes < 780)  return { status: 'break', label: '午休', nextOpen: '13:00' };
  if (totalMinutes < 960)  return { status: 'open', label: '交易中', nextOpen: '' };
  return { status: 'closed', label: '已收盘', nextOpen: '次日 09:30' };
}

/** US market: Mon-Fri 09:30-16:00 Eastern */
export function getUSMarketStatus(d: Date = new Date()): MarketInfo {
  const { totalMinutes, dayOfWeek } = tzInfo(d, 'America/New_York');
  if (dayOfWeek === 0 || dayOfWeek === 6) return { status: 'closed', label: '周末休市', nextOpen: '周一 09:30' };
  if (isHoliday(d, 'America/New_York')) return { status: 'closed', label: '假期休市', nextOpen: '下一交易日 09:30' };
  if (totalMinutes < 570) return { status: 'closed', label: '盘前', nextOpen: '09:30 EST' };
  if (totalMinutes < 960) return { status: 'open', label: '交易中', nextOpen: '' };
  return { status: 'closed', label: '已收盘', nextOpen: '次日 09:30 EST' };
}

/** Check if a symbol's market is currently open */
export function canTrade(symbol: string, d: Date = new Date()): {
  ok: boolean; reason: string; market: string; status: MarketStatus;
} {
  const isHK = /^\d{5}$/.test(symbol);
  const info = isHK ? getHKMarketStatus(d) : getUSMarketStatus(d);
  const market = isHK ? '港股' : '美股';
  if (info.status === 'open') return { ok: true, reason: '', market, status: 'open' };
  return { ok: false, reason: `${market}${info.label}，${info.nextOpen}开盘`, market, status: info.status };
}

export function formatHKTime(d: Date) {
  const { hours, minutes } = tzInfo(d, 'Asia/Hong_Kong');
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
