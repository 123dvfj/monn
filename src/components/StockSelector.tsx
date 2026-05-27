import { useState, useMemo } from 'react';
import { ALL_HK_STOCKS, ALL_US_STOCKS } from '../hooks/useStockData';
import { useT } from '../i18n/I18nContext';

const ALL_STOCKS = [...ALL_HK_STOCKS, ...ALL_US_STOCKS];

interface StockSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
  priceLabel?: React.ReactNode;
}

export default function StockSelector({ value, onChange, priceLabel }: StockSelectorProps) {
  const { t } = useT();
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const stockList = useMemo(() => {
    if (!searchText.trim()) return ALL_STOCKS;
    const kw = searchText.toUpperCase();
    return ALL_STOCKS.filter((s) => s.includes(kw)).slice(0, 30);
  }, [searchText]);

  const selectStock = (sym: string) => {
    onChange(sym);
    setSearchText('');
    setShowDropdown(false);
  };

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t('selectStock')}：</span>
      <input
        className="input"
        placeholder={t('searchCode')}
        value={searchText}
        onChange={(e) => { setSearchText(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        style={{ width: 260, fontSize: '13px' }}
      />
      {priceLabel && (
        <span style={{ fontSize: '14px', fontWeight: 600 }}>
          {value} {priceLabel}
        </span>
      )}
      {showDropdown && searchText && (
        <div style={{
          position: 'absolute', top: '100%', left: 80, width: 260,
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-sm)', zIndex: 100, maxHeight: 250, overflow: 'auto',
        }}>
          {stockList.map((s) => (
            <div key={s} onMouseDown={() => selectStock(s)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', fontFamily: 'monospace' }}
              className="sidebar-item">{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}
