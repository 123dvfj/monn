import { useState, useEffect } from 'react';
import { getHKMarketStatus, getUSMarketStatus, formatHKTime } from '../utils/marketHours';

const dotColors: Record<string, string> = {
  open: '#26a69a', closed: '#555', break: '#d29922',
};
const textColors: Record<string, string> = {
  open: 'var(--color-up)', closed: 'var(--text-tertiary)', break: 'var(--color-warning)',
};

export default function MarketClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hk = getHKMarketStatus(now);
  const us = getUSMarketStatus(now);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 18,
      fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {formatHKTime(now)}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColors[hk.status], flexShrink: 0 }} />
        <span style={{ color: textColors[hk.status] }}>港股 {hk.label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColors[us.status], flexShrink: 0 }} />
        <span style={{ color: textColors[us.status] }}>美股 {us.label}</span>
      </div>
    </div>
  );
}
