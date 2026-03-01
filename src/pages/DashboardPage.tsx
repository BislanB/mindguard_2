import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, formatTime } from '../store/index.js';
import { METRIC_CONFIG, MOOD_EMOJIS } from '../types/index.js';
import { WeeklyReview } from '../components/dashboard/WeeklyReview.js';

// ── 60 цитат на русском ──
const QUOTES = [
  { text: 'Каждый день — это маленькая жизнь.', author: 'Стив Джобс' },
  { text: 'Счастье — это не пункт назначения, а способ путешествия.', author: 'Рой Гудман' },
  { text: 'Мы то, что мы делаем постоянно. Совершенство — не действие, а привычка.', author: 'Аристотель' },
  { text: 'Великие дела начинаются с малого.', author: 'Лао-Цзы' },
  { text: 'Единственный способ делать великую работу — любить то, что делаешь.', author: 'Стив Джобс' },
  { text: 'Не бойся идти медленно, бойся стоять на месте.', author: 'Китайская пословица' },
  { text: 'Лучшее время посадить дерево было 20 лет назад. Следующее лучшее время — сейчас.', author: 'Китайская пословица' },
  { text: 'Сила не в том, чтобы никогда не падать, а в том, чтобы подниматься каждый раз.', author: 'Конфуций' },
  { text: 'Дисциплина — это мост между целями и достижениями.', author: 'Джим Рон' },
  { text: 'Всё, что можно измерить, можно улучшить.', author: 'Питер Друкер' },
  { text: 'Ваше тело слышит всё, что говорит ваш разум.', author: 'Наоми Жудд' },
  { text: 'Осознанность — это не сложно. Нам просто нужно не забывать её практиковать.', author: 'Шарон Зальцберг' },
  { text: 'Между стимулом и реакцией есть пространство. В этом пространстве — свобода выбора.', author: 'Виктор Франкл' },
  { text: 'Успех — это сумма маленьких усилий, повторяемых день за днём.', author: 'Роберт Кольер' },
  { text: 'Забота о себе — это не эгоизм, а необходимость.', author: 'Одри Лорд' },
  { text: 'Инвестиции в себя приносят лучшие проценты.', author: 'Бенджамин Франклин' },
  { text: 'Трудности подготавливают обычных людей к необычной судьбе.', author: 'К. С. Льюис' },
  { text: 'Путь в тысячу ли начинается с одного шага.', author: 'Лао-Цзы' },
  { text: 'Сегодняшние мечты — это завтрашняя реальность.', author: 'Альберт Эйнштейн' },
  { text: 'Ваш ум — это сад, ваши мысли — семена. Вы можете вырастить цветы или сорняки.', author: 'Неизвестный' },
  { text: 'Кто рано встаёт, тому бог подаёт.', author: 'Русская пословица' },
  { text: 'Нет ничего невозможного. Само слово говорит: "Я возможно!"', author: 'Одри Хепбёрн' },
  { text: 'Тишина — это язык бога, всё остальное — плохой перевод.', author: 'Руми' },
  { text: 'Стресс — это не то, что с вами происходит, а ваша реакция на происходящее.', author: 'Ганс Селье' },
  { text: 'Перемены — единственная постоянная в жизни.', author: 'Гераклит' },
  { text: 'Жизнь — это 10% того, что с нами происходит, и 90% того, как мы реагируем.', author: 'Чарльз Свиндолл' },
  { text: 'Сначала мы формируем привычки, потом привычки формируют нас.', author: 'Джон Драйден' },
  { text: 'Будь изменением, которое хочешь видеть в мире.', author: 'Махатма Ганди' },
  { text: 'Лучше сделать и пожалеть, чем не сделать и пожалеть.', author: 'Джованни Боккаччо' },
  { text: 'Тот, кто контролирует своё утро, контролирует свой день.', author: 'Робин Шарма' },
  { text: 'Не бойтесь совершенства — вам его никогда не достичь.', author: 'Сальвадор Дали' },
  { text: 'Простота — высшая форма изысканности.', author: 'Леонардо да Винчи' },
  { text: 'Когда кажется, что весь мир настроен против тебя, помни, что самолёт взлетает против ветра.', author: 'Генри Форд' },
  { text: 'Знание — сила, а привычка — вторая натура.', author: 'Фрэнсис Бэкон' },
  { text: 'Будущее принадлежит тем, кто верит в красоту своей мечты.', author: 'Элеонора Рузвельт' },
  { text: 'Не откладывай на завтра то, что можешь сделать сегодня.', author: 'Бенджамин Франклин' },
  { text: 'Самая тёмная ночь рождает самый яркий рассвет.', author: 'Джонатан Свифт' },
  { text: 'Сон — лучшая медитация.', author: 'Далай-лама' },
  { text: 'Ты не можешь вернуться и изменить начало, но ты можешь начать там, где ты сейчас.', author: 'К. С. Льюис' },
  { text: 'Мудрый человек требует всего только от себя, ничтожный же — от других.', author: 'Конфуций' },
  { text: 'Счастье зависит от нас самих.', author: 'Аристотель' },
  { text: 'Единственный предел наших достижений — наши сомнения.', author: 'Франклин Рузвельт' },
  { text: 'Дыхание — это мост, который соединяет жизнь с сознанием.', author: 'Тхить Нят Хань' },
  { text: 'Человек есть то, что он ест.', author: 'Людвиг Фейербах' },
  { text: 'Движение — это жизнь. Жизнь — это движение.', author: 'Аристотель' },
  { text: 'Терпение и труд всё перетрут.', author: 'Русская пословица' },
  { text: 'Чтобы иметь то, что никогда не имел, нужно делать то, что никогда не делал.', author: 'Коко Шанель' },
  { text: 'Не сравнивайте себя с другими — сравнивайте себя с собой вчерашним.', author: 'Джордан Питерсон' },
  { text: 'Каждое утро мы рождаемся заново. Важно лишь то, что мы делаем сегодня.', author: 'Будда' },
  { text: 'Покой — это не отсутствие бури, а спокойствие внутри неё.', author: 'Неизвестный' },
  { text: 'Маленькие шаги каждый день дают большие результаты.', author: 'Неизвестный' },
  { text: 'Время — самый ценный ресурс. Используйте его мудро.', author: 'Брюс Ли' },
  { text: 'Привычки — это невидимая архитектура нашей жизни.', author: 'Джеймс Клир' },
  { text: 'Минута, потраченная на планирование, экономит десять минут в исполнении.', author: 'Дейл Карнеги' },
  { text: 'Здоровье — это не всё, но без здоровья всё — ничто.', author: 'Сократ' },
  { text: 'Делай сегодня то, что другие не хотят, завтра будешь жить так, как другие не могут.', author: 'Джерри Райс' },
  { text: 'Ничего не изменится, пока вы сами не изменитесь. А потом всё изменится.', author: 'Неизвестный' },
  { text: 'Жизнь на 10% состоит из того, что происходит, и на 90% из того, как вы к этому относитесь.', author: 'Лу Хольц' },
  { text: 'Сила воли — как мышца: чем больше тренируешь, тем сильнее становится.', author: 'Келли Макгонигал' },
  { text: 'Самый лучший день в вашей жизни — сегодня.', author: 'Неизвестный' },
];

function getQuoteOfDay(): typeof QUOTES[0] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

export function DashboardPage() {
  const navigate = useNavigate();
  const entries = useAppStore((s) => s.entries);
  const goals = useAppStore((s) => s.goals);
  const currentFocusSession = useAppStore((s) => s.currentFocusSession);
  const calculateStreak = useAppStore((s) => s.calculateStreak);
  const saveQuickMood = useAppStore((s) => s.saveQuickMood);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [showWeeklyReview, setShowWeeklyReview] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = entries.find((e) => e.date === today);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yesterdayEntry = entries.find((e) => e.date === yesterday);
  const streak = calculateStreak();
  const quote = useMemo(() => getQuoteOfDay(), []);

  // Check if it's Sunday and user hasn't seen this week's review
  const isSunday = new Date().getDay() === 0;
  const weekKey = today; // Use today's date as key
  const shouldShowWeekly = isSunday && settings.lastSeenWeeklySummary !== weekKey && entries.length > 0;

  const dateStr = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const getGoalProgress = (goal: typeof goals[0]) => {
    const last7 = entries.filter((e) => Date.now() - new Date(e.date).getTime() < 7 * 86400000);
    const key = goal.metric as keyof typeof todayEntry;

    if (goal.metric === 'streak') {
      return { current: streak, target: goal.target, pct: Math.min(streak / goal.target, 1) };
    }
    if (goal.period === 'daily') {
      const val = todayEntry ? (todayEntry[key] as number) ?? 0 : 0;
      return { current: val, target: goal.target, pct: val ? Math.min(val / goal.target, 1) : 0 };
    }
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
        {entries.length > 3 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setShowWeeklyReview(true)}>📊</button>
        )}
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

      {/* Quote of the Day */}
      <div className="quote-card">
        <div className="quote-card__text">{quote.text}</div>
        <div className="quote-card__author">— {quote.author}</div>
      </div>

      {/* Quick Mood */}
      <div className="quick-mood">
        <div className="quick-mood__title">Как ты сейчас?</div>
        <div className="quick-mood__row">
          {MOOD_EMOJIS.map((m) => (
            <button key={m.value}
              className={`quick-mood__btn${todayEntry?.quickMood === m.emoji ? ' quick-mood__btn--active' : ''}`}
              onClick={() => saveQuickMood(m.emoji)}>
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
              <div className="metric-card__value">{val !== null ? `${val}${cfg.suffix}` : '—'}</div>
              {delta !== null && delta !== 0 && (
                <div className={`metric-card__trend ${delta > 0 ? 'metric-card__trend--up' : 'metric-card__trend--down'}`}>
                  {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Goals */}
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
                    {progress.current} / {progress.target}{progress.pct >= 1 && ' ✅'}
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
        <button className="btn btn--primary btn--lg" onClick={() => navigate('/track')}>Записать день</button>
      ) : (
        <button className="btn btn--secondary btn--lg" onClick={() => navigate(`/track/${today}`)}>Обновить запись</button>
      )}

      <div className="btn-row mt-12">
        <button className="btn btn--secondary" onClick={() => navigate('/history')}>📊 История</button>
        <button className="btn btn--secondary" onClick={() => navigate('/journal')}>📖 Дневник</button>
        <button className="btn btn--secondary" onClick={() => navigate('/analytics')}>📈 Аналитика</button>
      </div>

      {/* Active Focus */}
      {currentFocusSession && currentFocusSession.status === 'running' && (
        <div className="card card--accent mt-16" style={{ cursor: 'pointer', textAlign: 'center' }}
          onClick={() => navigate('/focus')}>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>Фокус-сессия активна</div>
          <div style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(currentFocusSession.remainingSeconds)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Нажмите для управления</div>
        </div>
      )}

      {/* Weekly Review */}
      {(showWeeklyReview || shouldShowWeekly) && (
        <WeeklyReview onClose={() => {
          setShowWeeklyReview(false);
          updateSettings({ lastSeenWeeklySummary: weekKey });
        }} />
      )}
    </div>
  );
}
