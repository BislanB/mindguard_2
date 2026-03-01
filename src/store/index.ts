import { create } from 'zustand';
import type {
  DailyEntry, JournalEntry, Goal, FocusSession,
  BlockRule, BlockAttempt, UserSettings, StreakMilestone,
} from '../types/index.js';
import { STREAK_MILESTONES } from '../types/index.js';
import * as db from '../db/index.js';
import { v4 as uuid } from 'uuid';

// ── Default Block Rules ──
function getDefaultBlockRules(): BlockRule[] {
  return [
    {
      id: uuid(), name: 'Соцсети', icon: '📱', category: 'social',
      targets: [
        { type: 'domain', value: 'vk.com' }, { type: 'domain', value: 'instagram.com' },
        { type: 'domain', value: 'facebook.com' }, { type: 'domain', value: 'twitter.com' },
        { type: 'domain', value: 'x.com' }, { type: 'domain', value: 'reddit.com' },
        { type: 'domain', value: 'ok.ru' }, { type: 'domain', value: 't.me' },
      ],
      mode: 'cooldown', cooldownMinutes: 10, dailyLimitMinutes: 60,
      schedule: null, enabled: true,
    },
    {
      id: uuid(), name: 'Короткие видео', icon: '🎬', category: 'shorts',
      targets: [
        { type: 'path', value: 'youtube.com/shorts' },
        { type: 'path', value: 'instagram.com/reels' },
        { type: 'domain', value: 'tiktok.com' },
        { type: 'path', value: 'vk.com/clips' },
        { type: 'path', value: 'facebook.com/reel' },
      ],
      mode: 'full', cooldownMinutes: 15, dailyLimitMinutes: 0,
      schedule: null, enabled: true,
    },
    {
      id: uuid(), name: 'Развлечения', icon: '🎮', category: 'entertainment',
      targets: [
        { type: 'domain', value: 'youtube.com' }, { type: 'domain', value: 'twitch.tv' },
        { type: 'domain', value: 'discord.com' }, { type: 'domain', value: 'netflix.com' },
        { type: 'domain', value: 'kinopoisk.ru' },
      ],
      mode: 'time-limit', cooldownMinutes: 10, dailyLimitMinutes: 60,
      schedule: null, enabled: false,
    },
    {
      id: uuid(), name: 'Взрослый контент', icon: '🔞', category: 'adult',
      targets: [
        { type: 'keyword', value: 'porn' }, { type: 'keyword', value: 'xxx' },
        { type: 'keyword', value: 'nsfw' }, { type: 'keyword', value: 'hentai' },
        { type: 'domain', value: 'pornhub.com' }, { type: 'domain', value: 'xvideos.com' },
        { type: 'domain', value: 'xhamster.com' }, { type: 'domain', value: 'xnxx.com' },
      ],
      mode: 'full', cooldownMinutes: 30, dailyLimitMinutes: 0,
      schedule: null, enabled: true,
    },
  ];
}

// ── Store ──

interface AppState {
  entries: DailyEntry[];
  journal: JournalEntry[];
  goals: Goal[];
  focusSessions: FocusSession[];
  currentFocusSession: FocusSession | null;
  blockRules: BlockRule[];
  blockAttempts: BlockAttempt[];
  settings: UserSettings;
  initialized: boolean;
  showCelebration: StreakMilestone | null;

  // Init
  init: () => Promise<void>;

  // Entries
  loadEntries: () => Promise<void>;
  saveEntry: (e: DailyEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getTodayEntry: () => DailyEntry | undefined;
  saveQuickMood: (emoji: string) => Promise<void>;

  // Streak
  calculateStreak: () => number;
  checkStreakCelebration: () => void;
  dismissCelebration: () => void;

  // Journal
  loadJournal: () => Promise<void>;
  saveJournalEntry: (e: JournalEntry) => Promise<void>;
  deleteJournalEntry: (id: string) => Promise<void>;

  // Goals
  loadGoals: () => Promise<void>;
  saveGoal: (g: Goal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  // Focus
  loadFocusSessions: () => Promise<void>;
  startFocusSession: (type: FocusSession['type'], minutes: number) => void;
  pauseFocusSession: () => void;
  resumeFocusSession: () => void;
  stopFocusSession: () => void;
  tickFocusSession: () => void;

  // Blocker
  loadBlockRules: () => Promise<void>;
  saveBlockRule: (r: BlockRule) => Promise<void>;
  deleteBlockRule: (id: string) => Promise<void>;
  loadBlockAttempts: () => Promise<void>;
  saveBlockAttempt: (a: BlockAttempt) => Promise<void>;
  checkUrl: (url: string) => { blocked: boolean; rule: BlockRule | null; mode: string };

  // Settings
  loadSettings: () => Promise<void>;
  updateSettings: (s: Partial<UserSettings>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  entries: [],
  journal: [],
  goals: [],
  focusSessions: [],
  currentFocusSession: null,
  blockRules: [],
  blockAttempts: [],
  settings: db.getDefaultSettings(),
  initialized: false,
  showCelebration: null,

  // ── Init ──
  init: async () => {
    if (get().initialized) return;
    await get().loadSettings();
    await get().loadEntries();
    await get().loadJournal();
    await get().loadGoals();
    await get().loadFocusSessions();
    await get().loadBlockRules();
    await get().loadBlockAttempts();

    // Restore active focus session
    const sessions = get().focusSessions;
    const active = sessions.find(s => s.status === 'running' || s.status === 'paused');
    if (active) set({ currentFocusSession: active });

    set({ initialized: true });
    get().checkStreakCelebration();
  },

  // ── Entries ──
  loadEntries: async () => {
    const entries = await db.getAllEntries();
    set({ entries });
  },

  saveEntry: async (e) => {
    await db.saveEntry(e);
    await get().loadEntries();
    get().checkStreakCelebration();
  },

  deleteEntry: async (id) => {
    await db.deleteEntry(id);
    await get().loadEntries();
  },

  getTodayEntry: () => {
    const today = new Date().toISOString().slice(0, 10);
    return get().entries.find(e => e.date === today);
  },

  saveQuickMood: async (emoji) => {
    const today = new Date().toISOString().slice(0, 10);
    const existing = get().entries.find(e => e.date === today);
    const now = new Date().toISOString();
    const entry: DailyEntry = existing
      ? { ...existing, quickMood: emoji, updatedAt: now }
      : {
        id: uuid(), date: today, sleep: null, stress: null, energy: null,
        mood: null, deepWork: null, quickMood: emoji, createdAt: now, updatedAt: now,
      };
    await get().saveEntry(entry);
  },

  // ── Streak ──
  calculateStreak: () => {
    const entries = get().entries
      .filter(e => e.mood !== null || e.quickMood !== null)
      .map(e => e.date)
      .sort((a, b) => b.localeCompare(a));

    if (entries.length === 0) return 0;

    const unique = [...new Set(entries)];
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (unique[0] !== today && unique[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 1; i < unique.length; i++) {
      const prev = new Date(unique[i - 1]);
      const curr = new Date(unique[i]);
      const diff = (prev.getTime() - curr.getTime()) / 86400000;
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  },

  checkStreakCelebration: () => {
    const streak = get().calculateStreak();
    const lastCelebrated = get().settings.lastStreakCelebration;
    const milestone = [...STREAK_MILESTONES]
      .reverse()
      .find(m => streak >= m.days && m.days > lastCelebrated);
    if (milestone) {
      set({ showCelebration: milestone });
    }
  },

  dismissCelebration: () => {
    const milestone = get().showCelebration;
    if (milestone) {
      get().updateSettings({ lastStreakCelebration: milestone.days });
    }
    set({ showCelebration: null });
  },

  // ── Journal ──
  loadJournal: async () => {
    const journal = await db.getAllJournalEntries();
    set({ journal });
  },

  saveJournalEntry: async (e) => {
    await db.saveJournalEntry(e);
    await get().loadJournal();
  },

  deleteJournalEntry: async (id) => {
    await db.deleteJournalEntry(id);
    await get().loadJournal();
  },

  // ── Goals ──
  loadGoals: async () => {
    const goals = await db.getAllGoals();
    set({ goals });
  },

  saveGoal: async (g) => {
    await db.saveGoal(g);
    await get().loadGoals();
  },

  deleteGoal: async (id) => {
    await db.deleteGoal(id);
    await get().loadGoals();
  },

  // ── Focus ──
  loadFocusSessions: async () => {
    const focusSessions = await db.getAllFocusSessions();
    set({ focusSessions });
  },

  startFocusSession: (type, minutes) => {
    const session: FocusSession = {
      id: uuid(), type, durationMinutes: minutes,
      remainingSeconds: minutes * 60, status: 'running',
      startedAt: new Date().toISOString(),
    };
    set({ currentFocusSession: session });
    db.saveFocusSession(session);
  },

  pauseFocusSession: () => {
    const s = get().currentFocusSession;
    if (s?.status === 'running') {
      const u = { ...s, status: 'paused' as const };
      set({ currentFocusSession: u });
      db.saveFocusSession(u);
    }
  },

  resumeFocusSession: () => {
    const s = get().currentFocusSession;
    if (s?.status === 'paused') {
      const u = { ...s, status: 'running' as const };
      set({ currentFocusSession: u });
      db.saveFocusSession(u);
    }
  },

  stopFocusSession: () => {
    const s = get().currentFocusSession;
    if (s) {
      const u = { ...s, status: 'cancelled' as const };
      set({ currentFocusSession: null });
      db.saveFocusSession(u);
      get().loadFocusSessions();
    }
  },

  tickFocusSession: () => {
    const s = get().currentFocusSession;
    if (s?.status === 'running') {
      const remaining = s.remainingSeconds - 1;
      if (remaining <= 0) {
        const u = { ...s, remainingSeconds: 0, status: 'completed' as const, completedAt: new Date().toISOString() };
        set({ currentFocusSession: null });
        db.saveFocusSession(u);
        get().loadFocusSessions();
        // Completion sound
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 800; gain.gain.value = 0.3;
          osc.start(); osc.stop(ctx.currentTime + 0.3);
        } catch { /* ignore */ }
        // Notification
        if (Notification.permission === 'granted') {
          new Notification('MindGuard', { body: 'Фокус-сессия завершена! 🎉', icon: '/pwa-192x192.png' });
        }
      } else {
        set({ currentFocusSession: { ...s, remainingSeconds: remaining } });
      }
    }
  },

  // ── Blocker ──
  loadBlockRules: async () => {
    let rules = await db.getAllBlockRules();
    if (rules.length === 0) {
      rules = getDefaultBlockRules();
      for (const r of rules) await db.saveBlockRule(r);
    }
    set({ blockRules: rules });
  },

  saveBlockRule: async (r) => {
    await db.saveBlockRule(r);
    await get().loadBlockRules();
  },

  deleteBlockRule: async (id) => {
    await db.deleteBlockRule(id);
    await get().loadBlockRules();
  },

  loadBlockAttempts: async () => {
    const blockAttempts = await db.getAllBlockAttempts();
    set({ blockAttempts });
  },

  saveBlockAttempt: async (a) => {
    await db.saveBlockAttempt(a);
    await get().loadBlockAttempts();
  },

  checkUrl: (url: string) => {
    const { blockRules, settings } = get();
    if (!settings.blockerEnabled) return { blocked: false, rule: null, mode: '' };

    const lowerUrl = url.toLowerCase();
    let hostname = '';
    try {
      hostname = new URL(lowerUrl.startsWith('http') ? lowerUrl : `https://${lowerUrl}`).hostname;
    } catch { hostname = lowerUrl; }

    for (const rule of blockRules) {
      if (!rule.enabled) continue;

      // Check schedule
      if (rule.schedule?.enabled) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = rule.schedule.startTime.split(':').map(Number);
        const [eh, em] = rule.schedule.endTime.split(':').map(Number);
        if (nowMin < sh * 60 + sm || nowMin > eh * 60 + em) continue;
        if (!rule.schedule.days.includes(now.getDay())) continue;
      }

      let matched = false;
      for (const t of rule.targets) {
        if (t.type === 'domain' && hostname.includes(t.value)) { matched = true; break; }
        if (t.type === 'keyword' && lowerUrl.includes(t.value.toLowerCase())) { matched = true; break; }
        if (t.type === 'path' && lowerUrl.includes(t.value.toLowerCase())) { matched = true; break; }
      }

      if (matched) {
        return { blocked: true, rule, mode: rule.mode };
      }
    }
    return { blocked: false, rule: null, mode: '' };
  },

  // ── Settings ──
  loadSettings: async () => {
    const settings = await db.getSettings();
    set({ settings });
    applyTheme(settings.theme);
  },

  updateSettings: async (partial) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    await db.saveSettings(updated);
    set({ settings: updated });
    if (partial.theme) applyTheme(partial.theme);
  },
}));

// ── Theme ──
function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  const set = (t: string) => root.setAttribute('data-theme', t);

  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    set(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', (e) => set(e.matches ? 'dark' : 'light'));
  } else {
    set(theme);
  }
}

// ── Helpers ──
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
