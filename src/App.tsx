import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from './store/index.js';
import { Layout } from './components/common/Layout.js';
import { PageTransition } from './components/common/PageTransition.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { TrackPage } from './pages/TrackPage.js';
import { FocusPage } from './pages/FocusPage.js';
import { BlockerPage } from './pages/BlockerPage.js';
import { JournalPage } from './pages/JournalPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { OnboardingPage } from './pages/OnboardingPage.js';
import { StreakCelebration } from './components/celebrations/StreakCelebration.js';

export function App() {
  const initialized = useAppStore((s) => s.initialized);
  const init = useAppStore((s) => s.init);
  const settings = useAppStore((s) => s.settings);
  const showCelebration = useAppStore((s) => s.showCelebration);

  useEffect(() => { init(); }, [init]);

  if (!initialized) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__logo">🛡️</div>
        <div className="loading-screen__text">MindGuard</div>
        {/* Skeleton preview */}
        <div style={{ width: 200, padding: '0 20px' }}>
          <div className="skeleton skeleton--text" style={{ width: '80%' }} />
          <div className="skeleton skeleton--text-sm" />
        </div>
      </div>
    );
  }

  if (!settings.onboardingCompleted) {
    return <OnboardingPage />;
  }

  return (
    <HashRouter>
      <Layout>
        <PageTransition>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/track" element={<TrackPage />} />
            <Route path="/track/:date" element={<TrackPage />} />
            <Route path="/focus" element={<FocusPage />} />
            <Route path="/blocker" element={<BlockerPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PageTransition>
      </Layout>
      {showCelebration && <StreakCelebration />}
    </HashRouter>
  );
}
