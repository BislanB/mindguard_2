import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/index.js';
import { MOOD_EMOJIS, METRIC_CONFIG } from '../types/index.js';

// ── Calendar Heatmap ──
function CalendarHeatmap({ entries }: { entries: ReturnType<typeof useAppStore.getState>['entries'] }) {
  const navigate = useNavigate();

  const heatmapData = useMemo(() => {
    const today = new Date();
    const cells: Array<{ date: string; level: number; isToday: boolean }> = [];

    // 12 weeks of data
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const entry = entries.find((e) => e.date === dateStr);

      let level = 0;
      if (entry) {
        const mood = entry.mood ?? (entry.quickMood ? MOOD_EMOJIS.find(m => m.emoji === entry.quickMood)?.value ?? 0 : 0);
        if (mood >= 1) level = 1;
        if (mood >= 3) level = 2;
        if (mood >= 5) level = 3;
        if (mood >= 8) level = 4;
      }

      cells.push({ date: dateStr, level, isToday: i === 0 });
    }
    return cells;
  }, [entries]);

  return (
    <div className="heatmap mb-20">
      <div className="card__header" style={{ marginBottom: 8 }}>📅 Активность</div>
      <div className="heatmap__grid">
        {heatmapData.map((cell) => (
          <div
            key={cell.date}
            className={`heatmap__cell${cell.level ? ` heatmap__cell--l${cell.level}` : ''}${cell.isToday ? ' heatmap__cell--today' : ''}`}
            title={cell.date}
            onClick={() => navigate(`/track/${cell.date}`)}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
        <span>12 нед. назад</span>
        <span>Сегодня</span>
      </div>
    </div>
  );
}

// ── History Page ──
export function HistoryPage() {
  const navigate = useNavigate();
  const entries = useAppStore((s) => s.entries);
  const deleteEntry = useAppStore((s) => s.deleteEntry);

  const sorted = [...entries]
    .filter((e) => e.mood !== null || e.quickMood !== null || e.sleep !== null)
    .sort((a, b) => b.date.localeCompare(a.date));

  const getMoodEmoji = (entry: typeof entries[0]) => {
    if (entry.quickMood) return entry.quickMood;
    if (entry.mood !== null) {
      if (entry.mood >= 8) return '🤩';
      if (entry.mood >= 6) return '😊';
      if (entry.mood >= 4) return '😐';
      if (entry.mood >= 2) return '😕';
      return '😢';
    }
    return '📊';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">История</h1>
      </div>

      <CalendarHeatmap entries={entries} />

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📋</div>
          <div className="empty-state__text">Нет записей. Начните трекинг!</div>
          <button className="btn btn--primary" onClick={() => navigate('/track')}>Записать день</button>
        </div>
      ) : (
        sorted.map((entry) => {
          const date = new Date(entry.date + 'T12:00:00').toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'short', weekday: 'short',
          });

          return (
            <div key={entry.id} className="history-item" onClick={() => navigate(`/track/${entry.date}`)}>
              <div className="history-item__mood">{getMoodEmoji(entry)}</div>
              <div className="history-item__info">
                <div className="history-item__date">{date}</div>
                <div className="history-item__metrics">
                  {entry.sleep !== null && <span>😴 {entry.sleep}ч</span>}
                  {entry.energy !== null && <span>⚡ {entry.energy}</span>}
                  {entry.stress !== null && <span>😰 {entry.stress}</span>}
                  {entry.mood !== null && <span>😊 {entry.mood}</span>}
                  {entry.deepWork !== null && <span>🎯 {entry.deepWork}ч</span>}
                </div>
              </div>
              <button className="btn btn--ghost btn--sm"
                style={{ color: 'var(--danger)', padding: '4px 8px' }}
                onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}>
                ✕
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
