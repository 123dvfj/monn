import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Technical from './pages/Technical';
import Fundamental from './pages/Fundamental';
import Capital from './pages/Capital';
import Screener from './pages/Screener';
import News from './pages/News';
import Tools from './pages/Tools';

import { useT } from './i18n/I18nContext';

function PageGuard({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default function App() {
  const { t } = useT();
  return (
    <div className="app-layout">
      <div className="titlebar">
        <span className="titlebar-title">{t('appTitle')}</span>
      </div>
      <ErrorBoundary>
        <Sidebar />
      </ErrorBoundary>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<PageGuard><Dashboard /></PageGuard>} />
          <Route path="/market" element={<PageGuard><Market /></PageGuard>} />
          <Route path="/technical" element={<PageGuard><Technical /></PageGuard>} />
          <Route path="/fundamental" element={<PageGuard><Fundamental /></PageGuard>} />
          <Route path="/capital" element={<PageGuard><Capital /></PageGuard>} />
          <Route path="/screener" element={<PageGuard><Screener /></PageGuard>} />
          <Route path="/news" element={<PageGuard><News /></PageGuard>} />
          <Route path="/tools" element={<PageGuard><Tools /></PageGuard>} />
        </Routes>
      </main>
    </div>
  );
}
