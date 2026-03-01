import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/index.js';
import { METRIC_CONFIG } from '../types/index.js';
import type { DailyEntry, CheckInType } from '../types/index.js';
import { v4 as uuid } from 'uuid';

export function TrackPage() {
    const { date: paramDate } = useParams();
    const navigate = useNavigate();
    const entries = useAppStore((s) => s.entries);
    const saveEntry = useAppStore((s) => s.saveEntry);
    const settings = useAppStore((s) => s.settings);
    const vibrate = useAppStore((s) => s.vibrate);

    const targetDate = paramDate || new Date().toISOString().slice(0, 10);
    const existing = entries.find((e) => e.date === targetDate);

    const [sleep, setSleep] = useState<number | null>(existing?.sleep ?? null);
    const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
    const [stress, setStress] = useState<number | null>(existing?.stress ?? null);
    const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
    const [deepWork, setDeepWork] = useState<number | null>(existing?.deepWork ?? null);
    const [morningNote, setMorningNote] = useState(existing?.morningNote ?? '');
    const [eveningNote, setEveningNote] = useState(existing?.eveningNote ?? '');
    const [saved, setSaved] = useState(false);
    const [activeSlider, setActiveSlider] = useState<string | null>(null);
    const [bouncingValue, setBouncingValue] = useState<string | null>(null);
    const bounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hour = new Date().getHours();
    const isMorning = hour < 14;
    const defaultCheckIn: CheckInType = (settings.morningCheckIn && isMorning) ? 'morning'
        : (settings.eveningCheckIn && !isMorning) ? 'evening' : 'full';
    const [checkInType, setCheckInType] = useState<CheckInType>(existing?.checkInType ?? defaultCheckIn);

    useEffect(() => {
        if (existing) {
            setSleep(existing.sleep); setEnergy(existing.energy); setStress(existing.stress);
            setMood(existing.mood); setDeepWork(existing.deepWork);
            setMorningNote(existing.morningNote ?? ''); setEveningNote(existing.eveningNote ?? '');
            setCheckInType(existing.checkInType ?? 'full');
        }
    }, [existing?.id]);

    const dateDisplay = new Date(targetDate + 'T12:00:00').toLocaleDateString('ru-RU', {
        weekday: 'short', day: 'numeric', month: 'long',
    });

    const triggerBounce = useCallback((key: string) => {
        setBouncingValue(key);
        vibrate(10);
        if (bounceTimer.current) clearTimeout(bounceTimer.current);
        bounceTimer.current = setTimeout(() => setBouncingValue(null), 200);
    }, [vibrate]);

    const handleSave = async () => {
        const now = new Date().toISOString();
        const entry: DailyEntry = {
            id: existing?.id ?? uuid(), date: targetDate,
            sleep, energy, stress, mood, deepWork,
            quickMood: existing?.quickMood ?? null, checkInType,
            morningNote: morningNote.trim() || null, eveningNote: eveningNote.trim() || null,
            createdAt: existing?.createdAt ?? now, updatedAt: now,
        };
        await saveEntry(entry);
        setSaved(true);
        setTimeout(() => navigate('/'), 600);
    };

    const morningMetrics = ['sleep', 'energy', 'mood'] as const;
    const eveningMetrics = ['stress', 'mood', 'deepWork'] as const;
    const allMetrics = ['sleep', 'energy', 'stress', 'mood', 'deepWork'] as const;
    const visibleMetrics = checkInType === 'morning' ? morningMetrics
        : checkInType === 'evening' ? eveningMetrics : allMetrics;

    const metrics = visibleMetrics.map(key => {
        const cfg = METRIC_CONFIG[key];
        const setters = { sleep: setSleep, energy: setEnergy, stress: setStress, mood: setMood, deepWork: setDeepWork };
        const values = { sleep, energy, stress, mood, deepWork };
        return { key, value: values[key], set: setters[key], ...cfg };
    });

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-header__title">{existing ? 'Обновить' : 'Записать'}</h1>
                    <div className="page-header__subtitle">{dateDisplay}</div>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>Назад</button>
            </div>

            {(settings.morningCheckIn || settings.eveningCheckIn) && (
                <div className="tabs" style={{ marginBottom: 16 }}>
                    {settings.morningCheckIn && (
                        <button className={`tabs__item${checkInType === 'morning' ? ' tabs__item--active' : ''}`}
                            onClick={() => setCheckInType('morning')}>🌅 Утро</button>
                    )}
                    <button className={`tabs__item${checkInType === 'full' ? ' tabs__item--active' : ''}`}
                        onClick={() => setCheckInType('full')}>📊 Полный</button>
                    {settings.eveningCheckIn && (
                        <button className={`tabs__item${checkInType === 'evening' ? ' tabs__item--active' : ''}`}
                            onClick={() => setCheckInType('evening')}>🌙 Вечер</button>
                    )}
                </div>
            )}

            {(checkInType === 'morning' || checkInType === 'full') && (
                <div className="checkin-note mb-16">
                    <div className="checkin-note__title">🌅 Что планируешь сегодня?</div>
                    <textarea className="textarea" value={morningNote}
                        onChange={(e) => setMorningNote(e.target.value)}
                        placeholder="Главные задачи, цели на день..."
                        rows={2} style={{ minHeight: 60 }} />
                </div>
            )}

            {/* Metric sliders with micro-animations */}
            {metrics.map((m) => {
                const current = m.value ?? m.min;
                const pct = ((current - m.min) / (m.max - m.min)) * 100;
                const gradientColor = m.key === 'stress'
                    ? (pct < 40 ? 'var(--success)' : pct < 70 ? 'var(--warning)' : 'var(--danger)')
                    : (pct < 30 ? 'var(--danger)' : pct < 60 ? 'var(--warning)' : 'var(--success)');
                const displayColor = m.value !== null ? gradientColor : 'var(--text-muted)';
                const isActive = activeSlider === m.key;
                const isBouncing = bouncingValue === m.key;

                return (
                    <div key={m.key} className={`slider-field${isActive ? ' slider-field--active' : ''}`}>
                        <div className="slider-field__header">
                            <div className="slider-field__label"><span>{m.emoji}</span> {m.label}</div>
                            <div className={`slider-field__value${isBouncing ? ' slider-field__value--bounce' : ''}`}
                                style={{ color: displayColor }}>
                                {m.value !== null ? `${m.value}${m.suffix}` : '—'}
                            </div>
                        </div>
                        <input type="range" min={m.min} max={m.max} step={m.step} value={m.value ?? m.min}
                            onPointerDown={() => setActiveSlider(m.key)}
                            onPointerUp={() => setActiveSlider(null)}
                            onPointerCancel={() => setActiveSlider(null)}
                            onChange={(e) => {
                                m.set(Number(e.target.value));
                                triggerBounce(m.key);
                            }}
                            style={{
                                background: m.value !== null
                                    ? `linear-gradient(to right, ${displayColor} ${pct}%, var(--bg-input) ${pct}%)`
                                    : 'var(--bg-input)',
                            }} />
                    </div>
                );
            })}

            {(checkInType === 'evening' || checkInType === 'full') && (
                <div className="checkin-note mb-16">
                    <div className="checkin-note__title">🌙 Как прошёл день?</div>
                    <textarea className="textarea" value={eveningNote}
                        onChange={(e) => setEveningNote(e.target.value)}
                        placeholder="Что получилось, что можно улучшить..."
                        rows={2} style={{ minHeight: 60 }} />
                </div>
            )}

            <div className="mt-24">
                <button className="btn btn--primary btn--lg" onClick={handleSave}>
                    {saved ? '✓ Сохранено!' : 'Сохранить'}
                </button>
            </div>
        </div>
    );
}
