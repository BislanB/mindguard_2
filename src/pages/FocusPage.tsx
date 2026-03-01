import { useState, useEffect, useRef } from 'react';
import { useAppStore, formatTime } from '../store/index.js';
import { AMBIENT_SOUNDS } from '../types/index.js';
import type { AmbientSound } from '../types/index.js';

// ── Breathing Exercise ──
function BreathingExercise() {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [counter, setCounter] = useState(4);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrate = useAppStore((s) => s.vibrate);

  useEffect(() => {
    if (!active) return;
    intervalRef.current = setInterval(() => {
      setCounter((c) => {
        if (c <= 1) {
          setPhase((p) => {
            vibrate(20);
            if (p === 'inhale') return 'hold';
            if (p === 'hold') return 'exhale';
            setCycles((cy) => cy + 1);
            return 'inhale';
          });
          return 4;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, vibrate]);

  const phaseText = phase === 'inhale' ? 'Вдох' : phase === 'hold' ? 'Задержка' : 'Выдох';
  const phaseEmoji = phase === 'inhale' ? '🫁' : phase === 'hold' ? '⏸️' : '💨';

  if (!active) {
    return (
      <div className="breathing">
        <div className="breathing__circle"><span style={{ fontSize: 48 }}>🫁</span></div>
        <div className="breathing__instruction">
          Дыхательное упражнение<br />
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>4 секунды вдох — 4 задержка — 4 выдох</span>
        </div>
        <button className="btn btn--primary btn--lg" onClick={() => { setActive(true); setCycles(0); }}>Начать</button>
      </div>
    );
  }

  return (
    <div className="breathing">
      <div className={`breathing__circle breathing__circle--${phase}`}>
        <span style={{ fontSize: 32 }}>{phaseEmoji}</span>
      </div>
      <div className="breathing__text">{phaseText}</div>
      <div className="breathing__timer">{counter}</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Цикл {cycles + 1}</div>
      <button className="btn btn--secondary" onClick={() => { setActive(false); setPhase('inhale'); setCounter(4); }}>Стоп</button>
    </div>
  );
}

// ── Focus Stats ──
function FocusStats() {
  const sessions = useAppStore((s) => s.focusSessions);
  const completed = sessions.filter((s) => s.status === 'completed');
  const totalMinutes = completed.reduce((sum, s) => sum + s.durationMinutes, 0);
  const pct = sessions.length > 0 ? Math.round((completed.length / sessions.length) * 100) : 0;
  const last7 = completed.filter((s) => Date.now() - new Date(s.startedAt).getTime() < 7 * 86400000);
  const weekMinutes = last7.reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <div>
      <div className="focus-stat-grid mb-20">
        <div className="focus-stat">
          <div className="focus-stat__value">{completed.length}</div>
          <div className="focus-stat__label">Завершено</div>
        </div>
        <div className="focus-stat">
          <div className="focus-stat__value">{(weekMinutes / 60).toFixed(1)}ч</div>
          <div className="focus-stat__label">За неделю</div>
        </div>
        <div className="focus-stat">
          <div className="focus-stat__value">{Math.round(totalMinutes / 60)}ч</div>
          <div className="focus-stat__label">Всего</div>
        </div>
        <div className="focus-stat">
          <div className="focus-stat__value" style={{ color: pct >= 70 ? 'var(--success)' : 'var(--warning)' }}>{pct}%</div>
          <div className="focus-stat__label">Завершаемость</div>
        </div>
      </div>

      {completed.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">⏱️</div>
          <div className="empty-state__text">Пока нет сессий. Запустите свою первую!</div>
        </div>
      )}

      {completed.slice(-10).reverse().map((s) => {
        const date = new Date(s.startedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const time = new Date(s.startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return (
          <div key={s.id} className="history-item">
            <div className="history-item__mood">{s.type === 'pomodoro' ? '🍅' : '🧠'}</div>
            <div className="history-item__info">
              <div className="history-item__date">{date} в {time}</div>
              <div className="history-item__metrics">
                <span>{s.durationMinutes} мин</span>
                <span>• {s.type === 'pomodoro' ? 'Помодоро' : 'Глубокая работа'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Focus Timer ──
function FocusTimer() {
  const current = useAppStore((s) => s.currentFocusSession);
  const currentAmbient = useAppStore((s) => s.currentAmbient);
  const start = useAppStore((s) => s.startFocusSession);
  const pause = useAppStore((s) => s.pauseFocusSession);
  const resume = useAppStore((s) => s.resumeFocusSession);
  const stop = useAppStore((s) => s.stopFocusSession);
  const tick = useAppStore((s) => s.tickFocusSession);
  const setAmbient = useAppStore((s) => s.setAmbientSound);

  const [type, setType] = useState<'pomodoro' | 'deepwork'>('pomodoro');
  const [minutes, setMinutes] = useState(25);
  const [ambient, setAmbientLocal] = useState<AmbientSound>('none');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (current?.status === 'running') {
      intervalRef.current = setInterval(tick, 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [current?.status, tick]);

  if (!current) {
    const totalSeconds = type === 'pomodoro' ? 25 * 60 : minutes * 60;
    return (
      <div className="focus-timer">
        <div className="tabs" style={{ width: '100%' }}>
          <button className={`tabs__item${type === 'pomodoro' ? ' tabs__item--active' : ''}`}
            onClick={() => { setType('pomodoro'); setMinutes(25); }}>🍅 Помодоро</button>
          <button className={`tabs__item${type === 'deepwork' ? ' tabs__item--active' : ''}`}
            onClick={() => { setType('deepwork'); setMinutes(60); }}>🧠 Глубокая</button>
        </div>

        {type === 'deepwork' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input className="input" type="number" min={10} max={180} step={5} value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))} style={{ width: 80, textAlign: 'center' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>минут</span>
          </div>
        )}

        {/* Ambient Sound Selector */}
        <div style={{ width: '100%' }}>
          <div className="form-label">🎵 Фоновый звук</div>
          <div className="ambient-grid">
            {AMBIENT_SOUNDS.map((s) => (
              <button key={s.id} className={`ambient-btn${ambient === s.id ? ' ambient-btn--active' : ''}`}
                onClick={() => setAmbientLocal(s.id)}>
                <span className="ambient-btn__emoji">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <TimerCircle remaining={totalSeconds} total={totalSeconds} />
        <button className="btn btn--primary btn--lg"
          onClick={() => start(type, type === 'pomodoro' ? 25 : minutes, ambient)}>Начать</button>
      </div>
    );
  }

  const total = current.durationMinutes * 60;
  return (
    <div className="focus-timer">
      <div className="focus-timer__label">
        {current.type === 'pomodoro' ? '🍅 Помодоро' : '🧠 Глубокая работа'}
        {current.status === 'paused' && <span className="badge badge--warning" style={{ marginLeft: 8 }}>Пауза</span>}
      </div>
      <TimerCircle remaining={current.remainingSeconds} total={total} />

      {/* Ambient sound control during session */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {AMBIENT_SOUNDS.slice(0, 4).map(s => (
          <button key={s.id}
            className={`chip${currentAmbient === s.id ? ' chip--active' : ''}`}
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={() => setAmbient(s.id)}>
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      <div className="focus-timer__controls">
        {current.status === 'running'
          ? <button className="btn btn--secondary" onClick={pause}>⏸ Пауза</button>
          : <button className="btn btn--primary" onClick={resume}>▶ Продолжить</button>}
        <button className="btn btn--danger" onClick={stop}>⏹ Стоп</button>
      </div>
    </div>
  );
}

function TimerCircle({ remaining, total }: { remaining: number; total: number }) {
  const progress = total > 0 ? remaining / total : 1;
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className="focus-timer__circle">
      <svg width="240" height="240" viewBox="0 0 240 240">
        <circle cx="120" cy="120" r={radius} fill="none" stroke="var(--bg-input)" strokeWidth="6" />
        <circle cx="120" cy="120" r={radius} fill="none" stroke="var(--accent)" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 8px var(--accent-glow))' }} />
      </svg>
      <div className="focus-timer__time">{formatTime(remaining)}</div>
    </div>
  );
}

// ── Main Page ──
export function FocusPage() {
  const [tab, setTab] = useState<'timer' | 'breathing' | 'stats'>('timer');
  const current = useAppStore((s) => s.currentFocusSession);

  return (
    <div>
      <div className="page-header"><h1 className="page-header__title">Фокус</h1></div>
      <div className="tabs">
        <button className={`tabs__item${tab === 'timer' ? ' tabs__item--active' : ''}`} onClick={() => setTab('timer')}>⏱ Таймер</button>
        <button className={`tabs__item${tab === 'breathing' ? ' tabs__item--active' : ''}`} onClick={() => setTab('breathing')}>🫁 Дыхание</button>
        <button className={`tabs__item${tab === 'stats' ? ' tabs__item--active' : ''}`} onClick={() => setTab('stats')}>📊 Стат</button>
      </div>
      {tab === 'timer' && <FocusTimer />}
      {tab === 'breathing' && <BreathingExercise />}
      {tab === 'stats' && <FocusStats />}
      {tab !== 'timer' && current && current.status === 'running' && (
        <div style={{
          position: 'fixed', top: 12, right: 12, background: 'var(--accent)', color: 'white',
          borderRadius: 'var(--radius)', padding: '8px 16px', fontSize: 16, fontWeight: 700,
          fontVariantNumeric: 'tabular-nums', boxShadow: 'var(--shadow-glow)', zIndex: 50, cursor: 'pointer'
        }}
          onClick={() => setTab('timer')}>
          {formatTime(current.remainingSeconds)}
        </div>
      )}
    </div>
  );
}
