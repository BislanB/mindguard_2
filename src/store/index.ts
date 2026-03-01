import { create } from 'zustand';
import type { ReportTemplate, ReportEntry, FocusSession, BlockRule, UnlockAttempt, UserSettings, BlockerSettings } from '../types/index.js';
import * as db from '../db/index.js';
import { createDefaultTemplates } from '../utils/defaultTemplates.js';
import { v4 as uuid } from 'uuid';

// ── App Store ──
interface AppState {
  templates: ReportTemplate[];
  reports: ReportEntry[];
  focusSessions: FocusSession[];
  blockRules: BlockRule[];
  unlockAttempts: UnlockAttempt[];
  settings: UserSettings;
  initialized: boolean;
  currentFocusSession: FocusSession | null;

  init: () => Promise<void>;

  // Templates
  loadTemplates: () => Promise<void>;
  saveTemplate: (t: ReportTemplate) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  // Reports
  loadReports: () => Promise<void>;
  saveReport: (r: ReportEntry) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  calculateStreak: () => number;

  // Focus
  startFocusSession: (type: FocusSession['type'], minutes: number) => void;
  pauseFocusSession: () => void;
  resumeFocusSession: () => void;
  stopFocusSession: () => void;
  tickFocusSession: () => void;

  // Block rules
  loadBlockRules: () => Promise<void>;
  saveBlockRule: (r: BlockRule) => Promise<void>;
  deleteBlockRule: (id: string) => Promise<void>;
  isUrlBlocked: (url: string) => boolean;

  // Unlock
  loadUnlockAttempts: () => Promise<void>;
  saveUnlockAttempt: (a: UnlockAttempt) => Promise<void>;

  // Settings
  loadSettings: () => Promise<void>;
  updateSettings: (s: Partial<UserSettings>) => Promise<void>;
  updateBlockerSettings: (s: Partial<BlockerSettings>) => Promise<void>;
  verifyPin: (pin: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  templates: [],
  reports: [],
  focusSessions: [],
  blockRules: [],
  unlockAttempts: [],
  settings: db.getDefaultSettings(),
  initialized: false,
  currentFocusSession: null,

  init: async () => {
    if (get().initialized) return;
    await get().loadSettings();
    await get().loadTemplates();
    await get().loadReports();
    await get().loadBlockRules();
    await get().loadUnlockAttempts();
    set({ initialized: true });
  },

  // ── Templates ──
  loadTemplates: async () => {
    let templates = await db.getAllTemplates();
    if (templates.length === 0) {
      const defaults = createDefaultTemplates();
      for (const t of defaults) {
        await db.saveTemplate(t);
      }
      templates = defaults;
    }
    set({ templates });
  },

  saveTemplate: async (t) => {
    await db.saveTemplate(t);
    await get().loadTemplates();
  },

  deleteTemplate: async (id) => {
    await db.deleteTemplate(id);
    await get().loadTemplates();
  },

  // ── Reports ──
  loadReports: async () => {
    const reports = await db.getAllReports();
    set({ reports });
  },

  saveReport: async (r) => {
    await db.saveReport(r);
    await get().loadReports();
  },

  deleteReport: async (id) => {
    await db.deleteReport(id);
    await get().loadReports();
  },

  calculateStreak: () => {
    const reports = get().reports.filter((r) => !r.isDraft);
    if (reports.length === 0) return 0;
    const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 1;
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = sorted[0].date.slice(0, 10);
    if (lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (lastDate !== yesterday) return 0;
    }
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date.slice(0, 10));
      const curr = new Date(sorted[i].date.slice(0, 10));
      const diff = (prev.getTime() - curr.getTime()) / 86400000;
      if (diff === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },

  // ── Focus Sessions ──
  startFocusSession: (type, minutes) => {
    const session: FocusSession = {
      id: uuid(),
      type,
      durationMinutes: minutes,
      remainingSeconds: minutes * 60,
      status: 'running',
      startedAt: new Date().toISOString(),
      blockingEnabled: true,
    };
    set({ currentFocusSession: session });
    db.saveFocusSession(session);
  },

  pauseFocusSession: () => {
    const session = get().currentFocusSession;
    if (session && session.status === 'running') {
      const updated = { ...session, status: 'paused' as const };
      set({ currentFocusSession: updated });
      db.saveFocusSession(updated);
    }
  },

  resumeFocusSession: () => {
    const session = get().currentFocusSession;
    if (session && session.status === 'paused') {
      const updated = { ...session, status: 'running' as const };
      set({ currentFocusSession: updated });
      db.saveFocusSession(updated);
    }
  },

  stopFocusSession: () => {
    const session = get().currentFocusSession;
    if (session) {
      const updated = { ...session, status: 'cancelled' as const };
      set({ currentFocusSession: null });
      db.saveFocusSession(updated);
    }
  },

  tickFocusSession: () => {
    const session = get().currentFocusSession;
    if (session && session.status === 'running') {
      const remaining = session.remainingSeconds - 1;
      if (remaining <= 0) {
        const updated = { ...session, remainingSeconds: 0, status: 'completed' as const, completedAt: new Date().toISOString() };
        set({ currentFocusSession: null });
        db.saveFocusSession(updated);
      } else {
        set({ currentFocusSession: { ...session, remainingSeconds: remaining } });
      }
    }
  },

  // ── Block Rules ──
  loadBlockRules: async () => {
    let rules = await db.getAllBlockRules();
    if (rules.length === 0) {
      const defaults = getDefaultBlockRules();
      for (const r of defaults) {
        await db.saveBlockRule(r);
      }
      rules = defaults;
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

  isUrlBlocked: (url: string) => {
    const { blockRules, settings, currentFocusSession } = get();
    if (!settings.blockerSettings.enabled) return false;
    const hostname = extractHostname(url);
    if (settings.blockerSettings.allowlist.some((a) => hostname.includes(a))) return false;

    for (const rule of blockRules) {
      if (!rule.enabled) continue;
      if (rule.duringFocusOnly && (!currentFocusSession || currentFocusSession.status !== 'running')) continue;
      if (rule.schedule?.enabled) {
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();
        const nowMin = h * 60 + m;
        const [sh, sm] = rule.schedule.startTime.split(':').map(Number);
        const [eh, em] = rule.schedule.endTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        if (nowMin < startMin || nowMin > endMin) continue;
        if (!rule.schedule.days.includes(now.getDay())) continue;
      }
      for (const domain of rule.domains) {
        if (hostname.includes(domain)) return true;
      }
      for (const kw of rule.keywords) {
        if (url.toLowerCase().includes(kw.toLowerCase())) return true;
      }
    }
    return false;
  },

  // ── Unlock Attempts ──
  loadUnlockAttempts: async () => {
    const attempts = await db.getAllUnlockAttempts();
    set({ unlockAttempts: attempts });
  },

  saveUnlockAttempt: async (a) => {
    await db.saveUnlockAttempt(a);
    await get().loadUnlockAttempts();
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

  updateBlockerSettings: async (partial) => {
    const current = get().settings;
    const updated = {
      ...current,
      blockerSettings: { ...current.blockerSettings, ...partial },
    };
    await db.saveSettings(updated);
    set({ settings: updated });
  },

  verifyPin: (pin: string) => {
    const stored = get().settings.blockerSettings.pin;
    return hashPin(pin) === stored;
  },
}));

// ── Helpers ──
function extractHostname(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {
    return url.toLowerCase();
  }
}

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function getDefaultBlockRules(): BlockRule[] {
  return [
    {
      id: uuid(),
      category: 'social',
      name: 'Соцсети',
      domains: [
        'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
        'tiktok.com', 'vk.com', 'ok.ru', 'reddit.com',
        'youtube.com', 'twitch.tv', 'discord.com', 't.me',
      ],
      keywords: [],
      enabled: true,
      strictLevel: 2,
      schedule: { enabled: false, startTime: '07:00', endTime: '23:00', days: [0, 1, 2, 3, 4, 5, 6] },
      duringFocusOnly: false,
    },
    {
      id: uuid(),
      category: 'adult',
      name: 'Взрослый контент',
      domains: [
        'pornhub.com', 'xvideos.com', 'xhamster.com', 'xnxx.com',
        'redtube.com', 'youporn.com', 'tube8.com', 'spankbang.com',
        'chaturbate.com', 'stripchat.com', 'bongacams.com',
      ],
      keywords: ['porn', 'xxx', 'nsfw', 'hentai'],
      enabled: true,
      strictLevel: 4,
      duringFocusOnly: false,
    },
    {
      id: uuid(),
      category: 'custom',
      name: 'Другое',
      domains: [],
      keywords: [],
      enabled: false,
      strictLevel: 1,
      duringFocusOnly: true,
    },
  ];
}
