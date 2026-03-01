// ── Daily Tracking ──

export type CheckInType = 'full' | 'morning' | 'evening';

export interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  sleep: number | null;
  stress: number | null;
  energy: number | null;
  mood: number | null;
  deepWork: number | null;
  quickMood: string | null; // emoji
  checkInType: CheckInType;
  morningNote: string | null;  // "What do you plan today?"
  eveningNote: string | null;  // "How was the day?"
  createdAt: string;
  updatedAt: string;
}

// ── Journal ──

export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  mood: string | null;
  tags: string[];            // #work #health #idea etc.
  createdAt: string;
  updatedAt: string;
}

// ── Goals ──

export type GoalMetric = 'sleep' | 'stress' | 'energy' | 'mood' | 'deepWork' | 'streak';

export interface Goal {
  id: string;
  metric: GoalMetric;
  target: number;
  comparison: 'gte' | 'lte'; // >= or <=
  label: string;
  emoji: string;
  period: 'daily' | 'weekly';
  enabled: boolean;
  createdAt: string;
}

// ── Focus ──

export type FocusType = 'pomodoro' | 'deepwork';
export type AmbientSound = 'none' | 'rain' | 'forest' | 'cafe' | 'waves' | 'fire' | 'whitenoise';

export interface FocusSession {
  id: string;
  type: FocusType;
  durationMinutes: number;
  remainingSeconds: number;
  status: 'running' | 'paused' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  ambientSound?: AmbientSound;
}

// ── Blocker (Ascent-style) ──

export type BlockMode = 'full' | 'cooldown' | 'time-limit';
export type StrictnessLevel = 'normal' | 'strict' | 'nuclear';

export interface BlockTarget {
  type: 'domain' | 'keyword' | 'path' | 'app';
  value: string; // domain or app packageName
}

export interface BlockSchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
  days: number[]; // 0=Sun..6=Sat
}

export interface BlockRule {
  id: string;
  name: string;
  icon: string;
  category: 'social' | 'shorts' | 'adult' | 'entertainment' | 'custom';
  targets: BlockTarget[];
  mode: BlockMode;
  cooldownMinutes: number;
  dailyLimitMinutes: number;
  schedule: BlockSchedule | null;
  strictness: StrictnessLevel;
  enabled: boolean;
}

export interface BlockAttempt {
  id: string;
  ruleId: string;
  ruleName: string;
  url: string;
  timestamp: string;
  action: 'blocked' | 'cooldown-started' | 'allowed-after-cooldown' | 'went-back';
}

// ── Streak Milestones ──

export interface StreakMilestone {
  days: number;
  emoji: string;
  title: string;
  message: string;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, emoji: '🌱', title: 'Первые ростки', message: '3 дня подряд! Привычка начинает формироваться.' },
  { days: 7, emoji: '🔥', title: 'Неделя!', message: '7 дней подряд! Ты на верном пути.' },
  { days: 14, emoji: '⭐', title: 'Две недели!', message: '14 дней! Привычка укрепляется.' },
  { days: 30, emoji: '🏆', title: 'Месяц!', message: '30 дней подряд! Невероятная дисциплина.' },
  { days: 60, emoji: '💎', title: 'Два месяца!', message: '60 дней! Ты — машина.' },
  { days: 100, emoji: '👑', title: 'Сотня!', message: '100 дней подряд! Легендарный результат.' },
];

// ── Settings ──

export type AppTheme = 'dark' | 'light' | 'system' | 'amoled' | 'ocean' | 'emerald' | 'rose';

export interface UserSettings {
  theme: AppTheme;
  notificationsEnabled: boolean;
  reminderTime: string; // HH:MM
  morningReminderTime: string;
  eveningReminderTime: string;
  morningCheckIn: boolean;
  eveningCheckIn: boolean;
  onboardingCompleted: boolean;
  lastStreakCelebration: number;
  lastSeenWeeklySummary: string | null;
  blockerEnabled: boolean;
  blockerPin: string;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

// ── Quick Mood ──

export const MOOD_EMOJIS = [
  { emoji: '😢', label: 'Ужасно', value: 1 },
  { emoji: '😕', label: 'Плохо', value: 2 },
  { emoji: '😐', label: 'Нормально', value: 3 },
  { emoji: '😊', label: 'Хорошо', value: 4 },
  { emoji: '🤩', label: 'Отлично', value: 5 },
] as const;

export const METRIC_CONFIG = {
  sleep: { label: 'Сон', emoji: '😴', suffix: 'ч', min: 0, max: 12, step: 0.5, color: '#818cf8' },
  energy: { label: 'Энергия', emoji: '⚡', suffix: '/10', min: 1, max: 10, step: 1, color: '#fbbf24' },
  stress: { label: 'Стресс', emoji: '😰', suffix: '/10', min: 1, max: 10, step: 1, color: '#f87171' },
  mood: { label: 'Настроение', emoji: '😊', suffix: '/10', min: 1, max: 10, step: 1, color: '#34d399' },
  deepWork: { label: 'Глубокая работа', emoji: '🎯', suffix: 'ч', min: 0, max: 16, step: 0.5, color: '#7c5cfc' },
} as const;

// ── Journal Tags ──

export const PREDEFINED_TAGS = [
  '💼 работа', '💪 здоровье', '💡 идея', '❤️ отношения', '📚 учёба',
  '💰 финансы', '🎯 цель', '🧠 психология', '🎨 хобби', '✈️ путешествие',
] as const;

// ── Ambient Sounds Config ──

export const AMBIENT_SOUNDS: Array<{ id: AmbientSound; label: string; emoji: string }> = [
  { id: 'none', label: 'Тишина', emoji: '🔇' },
  { id: 'rain', label: 'Дождь', emoji: '🌧️' },
  { id: 'forest', label: 'Лес', emoji: '🌲' },
  { id: 'cafe', label: 'Кофейня', emoji: '☕' },
  { id: 'waves', label: 'Волны', emoji: '🌊' },
  { id: 'fire', label: 'Камин', emoji: '🔥' },
  { id: 'whitenoise', label: 'Белый шум', emoji: '📻' },
];

// ── Day labels ──

export const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
