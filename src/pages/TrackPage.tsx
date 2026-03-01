import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/index.js';
import { METRIC_CONFIG } from '../types/index.js';
import type { DailyEntry } from '../types/index.js';
import { v4 as uuid } from 'uuid';

export function TrackPage() {
    const { date: paramDate } = useParams();
    const navigate = useNavigate();
    const entries = useAppStore((s) => s.entries);
    const saveEntry = useAppStore((s) => s.saveEntry);

    const targetDate = paramDate || new Date().toISOString().slice(0, 10);
    const existing = entries.find((e) => e.date === targetDate);

    const [sleep, setSleep] = useState<number | null>(existing?.sleep ?? null);
    const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
    const [stress, setStress] = useState<number | null>(existing?.stress ?? null);
    const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
    const [deepWork, setDeepWork] = useState<number | null>(existing?.deepWork ?? null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (existing) {
            setSleep(existing.sleep);
            setEnergy(existing.energy);
            setStress(existing.stress);
            setMood(existing.mood);
            setDeepWork(existing.deepWork);
        }
    }, [existing?.id]);

    const dateDisplay = new Date(targetDate + 'T12:00:00').toLocaleDateString('ru-RU', {
        weekday: 'short', day: 'numeric', month: 'long',
    });

    const handleSave = async () => {
        const now = new Date().toISOString();
        const entry: DailyEntry = {
            id: existing?.id ?? uuid(),
            date: targetDate,
            sleep, energy, stress, mood, deepWork,
            quickMood: existing?.quickMood ?? null,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        await saveEntry(entry);
        setSaved(true);
        setTimeout(() => {
            navigate('/');
        }, 600);
    };

    const metrics = [
        { key: 'sleep', value: sleep, set: setSleep, ...METRIC_CONFIG.sleep },
        { key: 'energy', value: energy, set: setEnergy, ...METRIC_CONFIG.energy },
        { key: 'stress', value: stress, set: setStress, ...METRIC_CONFIG.stress },
        { key: 'mood', value: mood, set: setMood, ...METRIC_CONFIG.mood },
        { key: 'deepWork', value: deepWork, set: setDeepWork, ...METRIC_CONFIG.deepWork },
    ];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-header__title">{existing ? 'Обновить' : 'Записать'}</h1>
                    <div className="page-header__subtitle">{dateDisplay}</div>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>Назад</button>
            </div>

            {metrics.map((m) => {
                const current = m.value ?? m.min;
                const pct = ((current - m.min) / (m.max - m.min)) * 100;
                const gradientColor = m.key === 'stress'
                    ? (pct < 40 ? 'var(--success)' : pct < 70 ? 'var(--warning)' : 'var(--danger)')
                    : (pct < 30 ? 'var(--danger)' : pct < 60 ? 'var(--warning)' : 'var(--success)');
                const displayColor = m.value !== null ? gradientColor : 'var(--text-muted)';

                return (
                    <div key={m.key} className="slider-field">
                        <div className="slider-field__header">
                            <div className="slider-field__label">
                                <span>{m.emoji}</span> {m.label}
                            </div>
                            <div className="slider-field__value" style={{ color: displayColor }}>
                                {m.value !== null ? `${m.value}${m.suffix}` : '—'}
                            </div>
                        </div>
                        <input
                            type="range"
                            min={m.min}
                            max={m.max}
                            step={m.step}
                            value={m.value ?? m.min}
                            onChange={(e) => m.set(Number(e.target.value))}
                            style={{
                                background: m.value !== null
                                    ? `linear-gradient(to right, ${displayColor} ${pct}%, var(--bg-input) ${pct}%)`
                                    : 'var(--bg-input)',
                            }}
                        />
                    </div>
                );
            })}

            <div className="mt-24">
                <button
                    className="btn btn--primary btn--lg"
                    onClick={handleSave}
                >
                    {saved ? '✓ Сохранено!' : 'Сохранить'}
                </button>
            </div>
        </div>
    );
}
