import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import MarketClock from './components/MarketClock';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Fundamental from './pages/Fundamental';
import Capital from './pages/Capital';
import Screener from './pages/Screener';
import News from './pages/News';
import Tools from './pages/Tools';
import Login from './pages/Login';
import Register from './pages/Register';
import Portfolio from './pages/Portfolio';
import BackgroundOrderChecker from './components/BackgroundOrderChecker';
import { useAuthStore } from './stores/authStore';

import { useT } from './i18n/I18nContext';

function PageGuard({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <PageGuard>{children}</PageGuard>;
}

export default function App() {
  const { t } = useT();
  return (
    <div className="app-layout">
      <div className="titlebar">
        <span className="titlebar-title">{t('appTitle')}</span>
        <div style={{ marginLeft: 'auto', marginRight: 16 }}>
          <MarketClock />
        </div>
      </div>
      <ErrorBoundary>
        <Sidebar />
      </ErrorBoundary>
      <BackgroundOrderChecker />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<PageGuard><Dashboard /></PageGuard>} />
          <Route path="/market" element={<PageGuard><Market /></PageGuard>} />
          <Route path="/fundamental" element={<PageGuard><Fundamental /></PageGuard>} />
          <Route path="/capital" element={<PageGuard><Capital /></PageGuard>} />
          <Route path="/screener" element={<PageGuard><Screener /></PageGuard>} />
          <Route path="/news" element={<PageGuard><News /></PageGuard>} />
          <Route path="/tools" element={<PageGuard><Tools /></PageGuard>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/portfolio" element={<AuthGuard><Portfolio /></AuthGuard>} />
        </Routes>
      </main>
    </div>
  );
}
