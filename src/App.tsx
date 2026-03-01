import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from './store/index.js';
import { Layout } from './components/common/Layout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ReportPage } from './pages/ReportPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { FocusPage } from './pages/FocusPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { TemplatePage } from './pages/TemplatePage.js';

export function App() {
  const initialized = useAppStore((s) => s.initialized);
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  if (!initialized) {
    return <div className="loading-screen">Загрузка...</div>;
  }

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/report/:id" element={<ReportPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/templates" element={<TemplatePage />} />
          <Route path="/templates/:id" element={<TemplatePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
