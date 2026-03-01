import { useNavigate } from 'react-router-dom';
import { useAppStore, formatTime } from '../store/index.js';
import { METRIC_CONFIG, MOOD_EMOJIS } from '../types/index.js';

export function DashboardPage() {
  const navigate = useNavigate();
  const entries = useAppStore((s) => s.entries);
  const goals = useAppStore((s) => s.goals);
  const currentFocusSession = useAppStore((s) => s.currentFocusSession);
  const calculateStreak = useAppStore((s) => s.calculateStreak);
  const saveQuickMood = useAppStore((s) => s.saveQuickMood);

  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = entries.find((e) => e.date === today);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yesterdayEntry = entries.find((e) => e.date === yesterday);
  const streak = calculateStreak();

  const dateStr = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Goal progress calculation
  const getGoalProgress = (goal: typeof goals[0]) => {
    const last7 = entries.filter((e) => {
      const d = new Date(e.date);
      return Date.now() - d.getTime() < 7 * 86400000;
    });
    const key = goal.metric as keyof typeof todayEntry;

    if (goal.metric === 'streak') {
      return { current: streak, target: goal.target, pct: Math.min(streak / goal.target, 1) };
    }

    if (goal.period === 'daily') {
      const val = todayEntry ? (todayEntry[key] as number) ?? 0 : 0;
      return { current: val, target: goal.target, pct: val ? Math.min(val / goal.target, 1) : 0 };
    }

    // weekly
    const vals = last7.map((e) => (e[key] as number) ?? 0).filter((v) => v > 0);
    if (goal.comparison === 'gte') {
      const count = vals.filter((v) => v >= goal.target).length;
      return { current: count, target: 7, pct: count / 7 };
    }
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { current: Math.round(avg * 10) / 10, target: goal.target, pct: avg ? Math.min(avg / goal.target, 1) : 0 };
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">MindGuard</h1>
          <div className="page-header__subtitle">{dateStr}</div>
        </div>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div className="streak-badge">
          <div className="streak-badge__fire">
            {streak >= 30 ? '🔥🔥🔥' : streak >= 14 ? '🔥🔥' : streak >= 7 ? '🔥' : '✨'}
          </div>
          <div>
            <div className="streak-badge__number">{streak}</div>
            <div className="streak-badge__text">
              {streak === 1 ? 'день подряд' : streak < 5 ? 'дня подряд' : 'дней подряд'}
            </div>
          </div>
        </div>
      )}

      {/* Quick Mood */}
      <div className="quick-mood">
        <div className="quick-mood__title">Как ты сейчас?</div>
        <div className="quick-mood__row">
          {MOOD_EMOJIS.map((m) => (
            <button
              key={m.value}
              className={`quick-mood__btn${todayEntry?.quickMood === m.emoji ? ' quick-mood__btn--active' : ''}`}
              onClick={() => saveQuickMood(m.emoji)}
            >
              <span>{m.emoji}</span>
              <span className="quick-mood__btn-label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Today's Metrics */}
      <div className="metrics-grid">
        {(Object.entries(METRIC_CONFIG) as [string, typeof METRIC_CONFIG.sleep][]).map(([key, cfg]) => {
          const val = todayEntry ? (todayEntry as any)[key] : null;
          const prevVal = yesterdayEntry ? (yesterdayEntry as any)[key] : null;
          const delta = val !== null && prevVal !== null ? val - prevVal : null;

          return (
            <div key={key} className="metric-card" onClick={() => navigate('/track')}>
              <div className="metric-card__emoji">{cfg.emoji}</div>
              <div className="metric-card__label">{cfg.label}</div>
              <div className="metric-card__value">
                {val !== null ? `${val}${cfg.suffix}` : '—'}
              </div>
              {delta !== null && delta !== 0 && (
                <div className={`metric-card__trend ${delta > 0 ? 'metric-card__trend--up' : 'metric-card__trend--down'}`}>
                  {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Goals Progress */}
      {goals.filter((g) => g.enabled).length > 0 && (
        <div className="card mb-20">
          <div className="card__header">🎯 Цели</div>
          {goals.filter((g) => g.enabled).map((g) => {
            const progress = getGoalProgress(g);
            const color = progress.pct >= 1 ? 'var(--success)' : progress.pct >= 0.5 ? 'var(--accent)' : 'var(--warning)';
            return (
              <div key={g.id} className="goal-item">
                <div className="goal-item__emoji">{g.emoji}</div>
                <div className="goal-item__info">
                  <div className="goal-item__label">{g.label}</div>
                  <div className="goal-item__detail">
                    {progress.current} / {progress.target}
                    {progress.pct >= 1 && ' ✅'}
                  </div>
                  <div className="goal-item__bar">
                    <div className="goal-item__fill" style={{ width: `${Math.min(progress.pct * 100, 100)}%`, background: color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      {!todayEntry || todayEntry.mood === null ? (
        <button className="btn btn--primary btn--lg" onClick={() => navigate('/track')}>
          Записать день
        </button>
      ) : (
        <button className="btn btn--secondary btn--lg" onClick={() => navigate(`/track/${today}`)}>
          Обновить запись
        </button>
      )}

      <div className="btn-row mt-12">
        <button className="btn btn--secondary" onClick={() => navigate('/history')}>📊 История</button>
        <button className="btn btn--secondary" onClick={() => navigate('/journal')}>📖 Дневник</button>
        <button className="btn btn--secondary" onClick={() => navigate('/analytics')}>📈 Аналитика</button>
      </div>

      {/* Active Focus */}
      {currentFocusSession && currentFocusSession.status === 'running' && (
        <div className="card card--accent mt-16" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => navigate('/focus')}>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>Фокус-сессия активна</div>
          <div style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(currentFocusSession.remainingSeconds)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Нажмите для управления</div>
        </div>
      )}
    </div>
  );
}
