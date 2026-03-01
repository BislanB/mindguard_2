import { useState, useMemo } from 'react';
import { useAppStore } from '../store/index.js';
import { METRIC_CONFIG } from '../types/index.js';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// ── Weekly Summary ──
function WeeklySummary() {
  const entries = useAppStore((s) => s.entries);
  const now = Date.now();
  const thisWeek = entries.filter((e) => now - new Date(e.date).getTime() < 7 * 86400000);
  const lastWeek = entries.filter((e) => {
    const diff = now - new Date(e.date).getTime();
    return diff >= 7 * 86400000 && diff < 14 * 86400000;
  });

  const avg = (arr: typeof entries, key: string) => {
    const vals = arr.map((e) => (e as any)[key]).filter((v: any) => v !== null && typeof v === 'number');
    return vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : null;
  };

  const metrics = [
    { key: 'sleep', ...METRIC_CONFIG.sleep },
    { key: 'energy', ...METRIC_CONFIG.energy },
    { key: 'stress', ...METRIC_CONFIG.stress },
    { key: 'mood', ...METRIC_CONFIG.mood },
    { key: 'deepWork', ...METRIC_CONFIG.deepWork },
  ];

  return (
    <div className="weekly-summary mb-20">
      <div className="weekly-summary__title">📊 Итоги недели</div>
      <div className="weekly-summary__grid">
        {metrics.map((m) => {
          const current = avg(thisWeek, m.key);
          const prev = avg(lastWeek, m.key);
          const delta = current !== null && prev !== null ? Math.round((current - prev) * 10) / 10 : null;
          const isStress = m.key === 'stress';
          const deltaGood = delta !== null && ((isStress && delta < 0) || (!isStress && delta > 0));

          return (
            <div key={m.key} className="weekly-summary__item">
              <div style={{ fontSize: 16 }}>{m.emoji}</div>
              <div className="weekly-summary__item-value">
                {current !== null ? `${current}` : '—'}
              </div>
              <div className="weekly-summary__item-label">{m.label}</div>
              {delta !== null && delta !== 0 && (
                <div className="weekly-summary__comparison" style={{ color: deltaGood ? 'var(--success)' : 'var(--danger)' }}>
                  {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}
                </div>
              )}
            </div>
          );
        })}
        <div className="weekly-summary__item">
          <div style={{ fontSize: 16 }}>📝</div>
          <div className="weekly-summary__item-value">{thisWeek.length}</div>
          <div className="weekly-summary__item-label">Записей</div>
        </div>
      </div>
    </div>
  );
}

// ── Trend Chart ──
function TrendChart({ entries, metricKey, title, color, suffix }: {
  entries: ReturnType<typeof useAppStore.getState>['entries'];
  metricKey: string; title: string; color: string; suffix?: string;
}) {
  const data = entries
    .filter((e) => (e as any)[metricKey] !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      label: e.date.slice(5).replace('-', '.'),
      value: (e as any)[metricKey] as number,
    }));

  if (data.length < 2) return null;

  return (
    <div className="chart-container">
      <div className="chart-container__title">{title}</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13 }}
            formatter={(value: any) => [`${value}${suffix ?? ''}`, title]}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2}
            dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Insights ──
function Insights() {
  const entries = useAppStore((s) => s.entries);
  const insights: string[] = [];

  const recent = entries.filter(e => e.mood !== null || e.sleep !== null).sort((a, b) => b.date.localeCompare(a.date));
  if (recent.length < 3) return null;

  const last7 = recent.filter(e => Date.now() - new Date(e.date).getTime() < 7 * 86400000);

  // Sleep → energy
  const pairs = recent
    .filter(e => e.sleep !== null && e.energy !== null)
    .map(e => ({ sleep: e.sleep!, energy: e.energy! }));
  if (pairs.length >= 5) {
    const good = pairs.filter(p => p.sleep >= 7);
    const bad = pairs.filter(p => p.sleep < 7);
    if (good.length && bad.length) {
      const avgGood = good.reduce((s, p) => s + p.energy, 0) / good.length;
      const avgBad = bad.reduce((s, p) => s + p.energy, 0) / bad.length;
      if (avgGood > avgBad) {
        insights.push(`Когда сон ≥ 7ч, энергия: ${avgGood.toFixed(1)} vs ${avgBad.toFixed(1)}`);
      }
    }
  }

  // Stress average
  const stressVals = last7.map(e => e.stress).filter((v): v is number => v !== null);
  if (stressVals.length) {
    const avg = stressVals.reduce((s, v) => s + v, 0) / stressVals.length;
    insights.push(`Средний стресс за неделю: ${avg.toFixed(1)}/10`);
  }

  // Best mood day
  const moodEntries = last7.filter(e => e.mood !== null).sort((a, b) => b.mood! - a.mood!);
  if (moodEntries.length) {
    const best = moodEntries[0];
    const day = new Date(best.date + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'short' });
    insights.push(`Лучшее настроение: ${best.mood}/10 (${day})`);
  }

  // Deep work
  const dwVals = last7.map(e => e.deepWork).filter((v): v is number => v !== null);
  if (dwVals.length) {
    const avg = dwVals.reduce((s, v) => s + v, 0) / dwVals.length;
    insights.push(`Средняя глубокая работа: ${avg.toFixed(1)} ч/день`);
  }

  if (insights.length === 0) return null;

  return (
    <div className="mb-20">
      <div className="card__header">💡 Инсайты</div>
      {insights.map((text, i) => (
        <div key={i} className="card" style={{ marginBottom: 8, fontSize: 14, lineHeight: 1.5 }}>
          {text}
        </div>
      ))}
    </div>
  );
}

// ── Analytics Page ──
export function AnalyticsPage() {
  const entries = useAppStore((s) => s.entries);
  const [days, setDays] = useState(7);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - days * 86400000;
    return entries.filter((e) => new Date(e.date).getTime() >= cutoff);
  }, [entries, days]);

  const metrics = [
    { key: 'sleep', ...METRIC_CONFIG.sleep },
    { key: 'energy', ...METRIC_CONFIG.energy },
    { key: 'stress', ...METRIC_CONFIG.stress },
    { key: 'mood', ...METRIC_CONFIG.mood },
    { key: 'deepWork', ...METRIC_CONFIG.deepWork },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">Аналитика</h1>
      </div>

      <div className="tabs">
        <button className={`tabs__item${days === 7 ? ' tabs__item--active' : ''}`} onClick={() => setDays(7)}>7 дней</button>
        <button className={`tabs__item${days === 30 ? ' tabs__item--active' : ''}`} onClick={() => setDays(30)}>30 дней</button>
        <button className={`tabs__item${days === 90 ? ' tabs__item--active' : ''}`} onClick={() => setDays(90)}>90 дней</button>
      </div>

      <WeeklySummary />

      {/* Trends */}
      <div className="card__header">📈 Тренды</div>
      {metrics.map((m) => (
        <TrendChart key={m.key} entries={filtered} metricKey={m.key}
          title={m.label} color={m.color} suffix={m.suffix} />
      ))}

      <Insights />
    </div>
  );
}
