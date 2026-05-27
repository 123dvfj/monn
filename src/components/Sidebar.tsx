import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, CandlestickChart, FileText,
  Banknote, Search, Newspaper, Wrench, Clock, Bot, Globe,
} from 'lucide-react';
import { useT } from '../i18n/I18nContext';

interface NavItem {
  path: string;
  labelKey: keyof typeof import('../i18n/translations').zh;
  icon: React.ReactNode;
}

export default function Sidebar() {
  const { t, lang, toggleLang } = useT();

  const sections: { titleKey: NavItem['labelKey']; items: NavItem[] }[] = [
    {
      titleKey: 'overview',
      items: [
        { path: '/', labelKey: 'dashboard', icon: <LayoutDashboard size={16} /> },
      ],
    },
    {
      titleKey: 'marketAnalysis',
      items: [
        { path: '/market', labelKey: 'realtimeMarket', icon: <TrendingUp size={16} /> },
        { path: '/technical', labelKey: 'technicalAnalysis', icon: <CandlestickChart size={16} /> },
        { path: '/fundamental', labelKey: 'fundamental', icon: <FileText size={16} /> },
        { path: '/capital', labelKey: 'capitalFlow', icon: <Banknote size={16} /> },
      ],
    },
    {
      titleKey: 'decisionAid',
      items: [
        { path: '/screener', labelKey: 'smartScreener', icon: <Search size={16} /> },
        { path: '/news', labelKey: 'newsSentiment', icon: <Newspaper size={16} /> },
        { path: '/ai', labelKey: 'aiAnalysis', icon: <Bot size={16} /> },
      ],
    },
    {
      titleKey: 'tools',
      items: [
        { path: '/tools', labelKey: 'auxTools', icon: <Wrench size={16} /> },
        { path: '/review', labelKey: 'reviewStats', icon: <Clock size={16} /> },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">M</div>
        <span>Monn</span>
      </div>

      {sections.map((section) => (
        <div className="sidebar-section" key={section.titleKey}>
          <div className="sidebar-section-title">{t(section.titleKey)}</div>
          {section.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? 'active' : ''}`
              }
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
      ))}

      {/* Language Toggle */}
      <div style={{ marginTop: 'auto', padding: '12px' }}>
        <button
          className="btn btn-sm w-full"
          onClick={toggleLang}
          style={{ justifyContent: 'center', gap: 8 }}
        >
          <Globe size={14} />
          {lang === 'zh' ? 'English' : '中文'}
        </button>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
          {t('appVersion')}
        </div>
      </div>
    </aside>
  );
}
