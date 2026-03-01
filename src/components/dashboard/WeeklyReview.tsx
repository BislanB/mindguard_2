import { useState, useMemo } from 'react';
import { useAppStore } from '../../store/index.js';
import { METRIC_CONFIG } from '../../types/index.js';

export function WeeklyReview({ onClose }: { onClose: () => void }) {
    const [slide, setSlide] = useState(0);
    const entries = useAppStore((s) => s.entries);
    const focusSessions = useAppStore((s) => s.focusSessions);
    const journal = useAppStore((s) => s.journal);
    const streak = useAppStore((s) => s.calculateStreak);

    const data = useMemo(() => {
        const now = Date.now();
        const thisWeek = entries.filter(e => now - new Date(e.date).getTime() < 7 * 86400000);
        const lastWeek = entries.filter(e => {
            const d = now - new Date(e.date).getTime();
            return d >= 7 * 86400000 && d < 14 * 86400000;
        });

        const avg = (arr: typeof entries, key: string) => {
            const vals = arr.map(e => (e as any)[key]).filter((v: any) => v !== null && typeof v === 'number');
            return vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : null;
        };

        const metrics = Object.entries(METRIC_CONFIG).map(([key, cfg]) => ({
            key, ...cfg,
            current: avg(thisWeek, key),
            previous: avg(lastWeek, key),
        }));

        const bestDay = thisWeek.filter(e => e.mood !== null).sort((a, b) => (b.mood ?? 0) - (a.mood ?? 0))[0];
        const worstDay = thisWeek.filter(e => e.mood !== null).sort((a, b) => (a.mood ?? 0) - (b.mood ?? 0))[0];

        const focusWeek = focusSessions.filter(s => s.status === 'completed' && now - new Date(s.startedAt).getTime() < 7 * 86400000);
        const focusMinutes = focusWeek.reduce((sum, s) => sum + s.durationMinutes, 0);

        const journalWeek = journal.filter(j => now - new Date(j.createdAt).getTime() < 7 * 86400000);

        return { thisWeek, metrics, bestDay, worstDay, focusMinutes, focusCount: focusWeek.length, journalCount: journalWeek.length, streak: streak() };
    }, [entries, focusSessions, journal, streak]);

    const slides = [
        // Slide 0: Title
        () => (
            <div className="weekly-review__slide" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Итоги недели</div>
                <div style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
                    {data.thisWeek.length} {data.thisWeek.length === 1 ? 'запись' : data.thisWeek.length < 5 ? 'записи' : 'записей'} за неделю
                </div>
                {data.streak > 0 && (
                    <div className="streak-badge mt-24" style={{ maxWidth: 260, margin: '24px auto 0' }}>
                        <div className="streak-badge__fire">🔥</div>
                        <div><div className="streak-badge__number">{data.streak}</div>
                            <div className="streak-badge__text">дней подряд</div></div>
                    </div>
                )}
            </div>
        ),

        // Slide 1: Metrics
        () => (
            <div className="weekly-review__slide">
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, textAlign: 'center' }}>Средние показатели</div>
                <div className="weekly-summary__grid">
                    {data.metrics.map(m => {
                        const delta = m.current !== null && m.previous !== null ? Math.round((m.current - m.previous) * 10) / 10 : null;
                        const isStress = m.key === 'stress';
                        const good = delta !== null && ((isStress && delta < 0) || (!isStress && delta > 0));
                        return (
                            <div key={m.key} className="weekly-summary__item">
                                <div style={{ fontSize: 20 }}>{m.emoji}</div>
                                <div className="weekly-summary__item-value">{m.current ?? '—'}</div>
                                <div className="weekly-summary__item-label">{m.label}</div>
                                {delta !== null && delta !== 0 && (
                                    <div className="weekly-summary__comparison" style={{ color: good ? 'var(--success)' : 'var(--danger)' }}>
                                        {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        ),

        // Slide 2: Highlights
        () => (
            <div className="weekly-review__slide" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Яркие моменты</div>

                {data.bestDay && (
                    <div className="card mb-12" style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 32 }}>😊</span>
                            <div>
                                <div style={{ fontWeight: 700 }}>Лучший день</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {new Date(data.bestDay.date + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'short' })}
                                    {' — настроение '}{data.bestDay.mood}/10
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="card mb-12" style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 32 }}>🎯</span>
                        <div>
                            <div style={{ fontWeight: 700 }}>{data.focusCount} фокус-сессий</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {(data.focusMinutes / 60).toFixed(1)} часов глубокой работы
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 32 }}>📖</span>
                        <div>
                            <div style={{ fontWeight: 700 }}>{data.journalCount} записей в дневнике</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Рефлексия — ключ к росту</div>
                        </div>
                    </div>
                </div>
            </div>
        ),

        // Slide 3: Motivation
        () => (
            <div className="weekly-review__slide" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🚀</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>Продолжай!</div>
                <div style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
                    {data.thisWeek.length >= 5
                        ? 'Отличная неделя! Ты записывал почти каждый день. Так держать!'
                        : data.thisWeek.length >= 3
                            ? 'Хорошее начало! Попробуй записывать каждый день для лучших инсайтов.'
                            : 'Каждая запись важна. Начни с малого — одна запись в день.'}
                </div>
                <button className="btn btn--primary btn--lg mt-24" style={{ maxWidth: 280 }} onClick={onClose}>
                    К новой неделе →
                </button>
            </div>
        ),
    ];

    const totalSlides = slides.length;

    return (
        <div className="celebration-overlay" onClick={onClose}>
            <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }} onClick={e => e.stopPropagation()}>
                <div className="weekly-review">
                    {slides[slide]()}

                    <div className="weekly-review__nav">
                        <div className="weekly-review__dots">
                            {Array.from({ length: totalSlides }).map((_, i) => (
                                <div key={i} className={`weekly-review__dot${i === slide ? ' weekly-review__dot--active' : ''}`}
                                    onClick={() => setSlide(i)} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {slide > 0 && (
                                <button className="btn btn--ghost btn--sm" onClick={() => setSlide(s => s - 1)}>←</button>
                            )}
                            {slide < totalSlides - 1 && (
                                <button className="btn btn--primary btn--sm" onClick={() => setSlide(s => s + 1)}>Далее →</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
