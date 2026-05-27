import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, CandlestickChart, FileText,
  Banknote, Search, Newspaper, Wrench, Clock, Bot,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: '概览',
    items: [
      { path: '/', label: '工作台', icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    title: '行情分析',
    items: [
      { path: '/market', label: '实时行情', icon: <TrendingUp size={16} /> },
      { path: '/technical', label: '技术分析', icon: <CandlestickChart size={16} /> },
      { path: '/fundamental', label: '基本面', icon: <FileText size={16} /> },
      { path: '/capital', label: '资金筹码', icon: <Banknote size={16} /> },
    ],
  },
  {
    title: '决策辅助',
    items: [
      { path: '/screener', label: '智能选股', icon: <Search size={16} /> },
      { path: '/news', label: '资讯舆情', icon: <Newspaper size={16} /> },
      { path: '/ai', label: 'AI 分析', icon: <Bot size={16} /> },
    ],
  },
  {
    title: '工具',
    items: [
      { path: '/tools', label: '辅助工具', icon: <Wrench size={16} /> },
      { path: '/review', label: '复盘统计', icon: <Clock size={16} /> },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">M</div>
        <span>Monn</span>
      </div>

      {sections.map((section) => (
        <div className="sidebar-section" key={section.title}>
          <div className="sidebar-section-title">{section.title}</div>
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
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}

      <div style={{ marginTop: 'auto', padding: '16px 12px' }}>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Monn v1.1.0
        </div>
      </div>
    </aside>
  );
}
