import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Technical from './pages/Technical';
import Fundamental from './pages/Fundamental';
import Capital from './pages/Capital';
import Screener from './pages/Screener';
import News from './pages/News';
import Tools from './pages/Tools';
import Review from './pages/Review';
import AIAnalysis from './pages/AIAnalysis';
import { useT } from './i18n/I18nContext';

export default function App() {
  const { t } = useT();
  return (
    <div className="app-layout">
      <div className="titlebar">
        <span className="titlebar-title">{t('appTitle')}</span>
      </div>
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/market" element={<Market />} />
          <Route path="/technical" element={<Technical />} />
          <Route path="/fundamental" element={<Fundamental />} />
          <Route path="/capital" element={<Capital />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/news" element={<News />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/review" element={<Review />} />
          <Route path="/ai" element={<AIAnalysis />} />
        </Routes>
      </main>
    </div>
  );
}
