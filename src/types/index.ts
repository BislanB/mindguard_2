// ── Daily Tracking ──

export interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  sleep: number | null;
  stress: number | null;
  energy: number | null;
  mood: number | null;
  deepWork: number | null;
  quickMood: string | null; // emoji
  createdAt: string;
  updatedAt: string;
}

// ── Journal ──

export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  mood: string | null;
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

export interface FocusSession {
  id: string;
  type: FocusType;
  durationMinutes: number;
  remainingSeconds: number;
  status: 'running' | 'paused' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
}

// ── Blocker (Ascent-style) ──

export type BlockMode = 'full' | 'cooldown' | 'time-limit';

export interface BlockTarget {
  type: 'domain' | 'keyword' | 'path';
  value: string;
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

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  reminderTime: string; // HH:MM
  onboardingCompleted: boolean;
  lastStreakCelebration: number;
  lastSeenWeeklySummary: string | null;
  blockerEnabled: boolean;
  blockerPin: string;
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
  sleep:    { label: 'Сон',            emoji: '😴', suffix: 'ч', min: 0, max: 12, step: 0.5, color: '#818cf8' },
  energy:   { label: 'Энергия',        emoji: '⚡', suffix: '/10', min: 1, max: 10, step: 1, color: '#fbbf24' },
  stress:   { label: 'Стресс',         emoji: '😰', suffix: '/10', min: 1, max: 10, step: 1, color: '#f87171' },
  mood:     { label: 'Настроение',     emoji: '😊', suffix: '/10', min: 1, max: 10, step: 1, color: '#34d399' },
  deepWork: { label: 'Глубокая работа', emoji: '🎯', suffix: 'ч', min: 0, max: 16, step: 0.5, color: '#7c5cfc' },
} as const;
