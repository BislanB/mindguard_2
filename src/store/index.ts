import { create } from 'zustand';
import type {
  DailyEntry, JournalEntry, Goal, FocusSession,
  BlockRule, BlockAttempt, UserSettings, StreakMilestone, AmbientSound, AppTheme,
} from '../types/index.js';
import { STREAK_MILESTONES } from '../types/index.js';
import * as db from '../db/index.js';
import { v4 as uuid } from 'uuid';

// ── Ambient Sound Engine ──
let ambientCtx: AudioContext | null = null;
let ambientSource: AudioBufferSourceNode | null = null;
let ambientGain: GainNode | null = null;
let ambientOsc: OscillatorNode | null = null;

function stopAmbient() {
  try { ambientSource?.stop(); } catch { }
  try { ambientOsc?.stop(); } catch { }
  ambientSource = null; ambientOsc = null;
}

function playAmbient(sound: AmbientSound) {
  stopAmbient();
  if (sound === 'none') return;
  if (!ambientCtx) ambientCtx = new AudioContext();
  ambientGain = ambientCtx.createGain();
  ambientGain.gain.value = 0.15;
  ambientGain.connect(ambientCtx.destination);

  // Generate procedural ambient sounds
  if (sound === 'whitenoise') {
    const bufferSize = ambientCtx.sampleRate * 10;
    const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    ambientSource = ambientCtx.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;
    ambientSource.connect(ambientGain);
    ambientSource.start();
  } else {
    // Low-frequency ambient: different frequencies for different "environments"
    const freqs: Record<string, number[]> = {
      rain: [120, 180, 240], forest: [200, 320, 500], cafe: [150, 250, 380],
      waves: [80, 130, 200], fire: [100, 160, 220],
    };
    const f = freqs[sound] || [150, 250];
    // Create brownian noise with filtering for natural sound
    const bufferSize = ambientCtx.sampleRate * 8;
    const buffer = ambientCtx.createBuffer(2, bufferSize, ambientCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let last = 0;
      const speed = sound === 'waves' ? 0.03 : sound === 'rain' ? 0.08 : 0.05;
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ambientCtx.sampleRate;
        let val = 0;
        for (const freq of f) val += Math.sin(t * freq * 0.01 + ch) * 0.1;
        val += (Math.random() * 2 - 1) * speed;
        last = last * 0.98 + val * 0.02;
        data[i] = last * 0.5;
      }
    }
    ambientSource = ambientCtx.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;
    ambientSource.connect(ambientGain);
    ambientSource.start();
  }
}

// ── Sound Effects ──
function playSound(type: 'complete' | 'click' | 'success' | 'warning') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.value = 0.2;
    if (type === 'complete') {
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'click') {
      osc.frequency.value = 600; gain.gain.value = 0.1;
      osc.start(); osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.value = 300; osc.type = 'square'; gain.gain.value = 0.15;
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    }
  } catch { }
}

function vibrate(pattern: number | number[] = 30) {
  try { navigator.vibrate?.(pattern); } catch { }
}

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
        { type: 'app', value: 'com.instagram.android' }, { type: 'app', value: 'com.vkontakte.android' },
        { type: 'app', value: 'com.facebook.katana' }, { type: 'app', value: 'com.twitter.android' },
      ],
      mode: 'cooldown', cooldownMinutes: 10, dailyLimitMinutes: 60,
      schedule: null, strictness: 'normal', enabled: true,
    },
    {
      id: uuid(), name: 'Короткие видео', icon: '🎬', category: 'shorts',
      targets: [
        { type: 'path', value: 'youtube.com/shorts' },
        { type: 'path', value: 'instagram.com/reels' },
        { type: 'domain', value: 'tiktok.com' },
        { type: 'path', value: 'vk.com/clips' },
        { type: 'app', value: 'com.zhiliaoapp.musically' },
      ],
      mode: 'full', cooldownMinutes: 15, dailyLimitMinutes: 0,
      schedule: null, strictness: 'strict', enabled: true,
    },
    {
      id: uuid(), name: 'Развлечения', icon: '🎮', category: 'entertainment',
      targets: [
        { type: 'domain', value: 'youtube.com' }, { type: 'domain', value: 'twitch.tv' },
        { type: 'domain', value: 'discord.com' }, { type: 'domain', value: 'netflix.com' },
        { type: 'domain', value: 'kinopoisk.ru' },
        { type: 'app', value: 'com.google.android.youtube' },
      ],
      mode: 'time-limit', cooldownMinutes: 10, dailyLimitMinutes: 60,
      schedule: null, strictness: 'normal', enabled: false,
    },
    {
      id: uuid(), name: 'Взрослый контент', icon: '🔞', category: 'adult',
      targets: [
        { type: 'keyword', value: 'porn' }, { type: 'keyword', value: 'xxx' },
        { type: 'keyword', value: 'nsfw' }, { type: 'keyword', value: 'hentai' },
        { type: 'domain', value: 'pornhub.com' }, { type: 'domain', value: 'xvideos.com' },
      ],
      mode: 'full', cooldownMinutes: 30, dailyLimitMinutes: 0,
      schedule: null, strictness: 'nuclear', enabled: true,
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
  currentAmbient: AmbientSound;
  blockRules: BlockRule[];
  blockAttempts: BlockAttempt[];
  settings: UserSettings;
  initialized: boolean;
  showCelebration: StreakMilestone | null;

  init: () => Promise<void>;
  loadEntries: () => Promise<void>;
  saveEntry: (e: DailyEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getTodayEntry: () => DailyEntry | undefined;
  saveQuickMood: (emoji: string) => Promise<void>;
  calculateStreak: () => number;
  checkStreakCelebration: () => void;
  dismissCelebration: () => void;
  loadJournal: () => Promise<void>;
  saveJournalEntry: (e: JournalEntry) => Promise<void>;
  deleteJournalEntry: (id: string) => Promise<void>;
  loadGoals: () => Promise<void>;
  saveGoal: (g: Goal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  loadFocusSessions: () => Promise<void>;
  startFocusSession: (type: FocusSession['type'], minutes: number, ambient?: AmbientSound) => void;
  pauseFocusSession: () => void;
  resumeFocusSession: () => void;
  stopFocusSession: () => void;
  tickFocusSession: () => void;
  setAmbientSound: (sound: AmbientSound) => void;
  loadBlockRules: () => Promise<void>;
  saveBlockRule: (r: BlockRule) => Promise<void>;
  deleteBlockRule: (id: string) => Promise<void>;
  loadBlockAttempts: () => Promise<void>;
  saveBlockAttempt: (a: BlockAttempt) => Promise<void>;
  checkUrl: (url: string) => { blocked: boolean; rule: BlockRule | null; mode: string; strictness: string };
  loadSettings: () => Promise<void>;
  updateSettings: (s: Partial<UserSettings>) => Promise<void>;
  playSound: (type: 'complete' | 'click' | 'success' | 'warning') => void;
  vibrate: (pattern?: number | number[]) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  entries: [],
  journal: [],
  goals: [],
  focusSessions: [],
  currentFocusSession: null,
  currentAmbient: 'none' as AmbientSound,
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
    const sessions = get().focusSessions;
    const active = sessions.find(s => s.status === 'running' || s.status === 'paused');
    if (active) {
      set({ currentFocusSession: active });
      if (active.ambientSound && active.status === 'running') {
        playAmbient(active.ambientSound);
        set({ currentAmbient: active.ambientSound });
      }
    }
    set({ initialized: true });
    get().checkStreakCelebration();
  },

  // ── Entries ──
  loadEntries: async () => { set({ entries: await db.getAllEntries() }); },
  saveEntry: async (e) => {
    await db.saveEntry(e);
    await get().loadEntries();
    get().checkStreakCelebration();
    if (get().settings.soundEnabled) playSound('success');
    if (get().settings.vibrationEnabled) vibrate(50);
  },
  deleteEntry: async (id) => { await db.deleteEntry(id); await get().loadEntries(); },
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
        mood: null, deepWork: null, quickMood: emoji,
        checkInType: 'full', morningNote: null, eveningNote: null,
        createdAt: now, updatedAt: now,
      };
    await get().saveEntry(entry);
    if (get().settings.vibrationEnabled) vibrate(30);
  },

  // ── Streak ──
  calculateStreak: () => {
    const entries = get().entries
      .filter(e => e.mood !== null || e.quickMood !== null)
      .map(e => e.date).sort((a, b) => b.localeCompare(a));
    if (entries.length === 0) return 0;
    const unique = [...new Set(entries)];
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (unique[0] !== today && unique[0] !== yesterday) return 0;
    let streak = 1;
    for (let i = 1; i < unique.length; i++) {
      const diff = (new Date(unique[i - 1]).getTime() - new Date(unique[i]).getTime()) / 86400000;
      if (diff === 1) streak++; else break;
    }
    return streak;
  },
  checkStreakCelebration: () => {
    const streak = get().calculateStreak();
    const last = get().settings.lastStreakCelebration;
    const milestone = [...STREAK_MILESTONES].reverse().find(m => streak >= m.days && m.days > last);
    if (milestone) {
      set({ showCelebration: milestone });
      if (get().settings.soundEnabled) playSound('complete');
      if (get().settings.vibrationEnabled) vibrate([100, 50, 100, 50, 200]);
    }
  },
  dismissCelebration: () => {
    const m = get().showCelebration;
    if (m) get().updateSettings({ lastStreakCelebration: m.days });
    set({ showCelebration: null });
  },

  // ── Journal ──
  loadJournal: async () => { set({ journal: await db.getAllJournalEntries() }); },
  saveJournalEntry: async (e) => { await db.saveJournalEntry(e); await get().loadJournal(); },
  deleteJournalEntry: async (id) => { await db.deleteJournalEntry(id); await get().loadJournal(); },

  // ── Goals ──
  loadGoals: async () => { set({ goals: await db.getAllGoals() }); },
  saveGoal: async (g) => { await db.saveGoal(g); await get().loadGoals(); },
  deleteGoal: async (id) => { await db.deleteGoal(id); await get().loadGoals(); },

  // ── Focus ──
  loadFocusSessions: async () => { set({ focusSessions: await db.getAllFocusSessions() }); },
  startFocusSession: (type, minutes, ambient = 'none') => {
    const session: FocusSession = {
      id: uuid(), type, durationMinutes: minutes,
      remainingSeconds: minutes * 60, status: 'running',
      startedAt: new Date().toISOString(), ambientSound: ambient,
    };
    set({ currentFocusSession: session, currentAmbient: ambient });
    db.saveFocusSession(session);
    playAmbient(ambient);
    if (get().settings.soundEnabled) playSound('click');
  },
  pauseFocusSession: () => {
    const s = get().currentFocusSession;
    if (s?.status === 'running') {
      const u = { ...s, status: 'paused' as const };
      set({ currentFocusSession: u });
      db.saveFocusSession(u);
      stopAmbient();
    }
  },
  resumeFocusSession: () => {
    const s = get().currentFocusSession;
    if (s?.status === 'paused') {
      const u = { ...s, status: 'running' as const };
      set({ currentFocusSession: u });
      db.saveFocusSession(u);
      if (s.ambientSound) playAmbient(s.ambientSound);
    }
  },
  stopFocusSession: () => {
    const s = get().currentFocusSession;
    if (s) {
      const u = { ...s, status: 'cancelled' as const };
      set({ currentFocusSession: null, currentAmbient: 'none' });
      db.saveFocusSession(u);
      get().loadFocusSessions();
      stopAmbient();
    }
  },
  tickFocusSession: () => {
    const s = get().currentFocusSession;
    if (s?.status === 'running') {
      const remaining = s.remainingSeconds - 1;
      if (remaining <= 0) {
        const u = { ...s, remainingSeconds: 0, status: 'completed' as const, completedAt: new Date().toISOString() };
        set({ currentFocusSession: null, currentAmbient: 'none' });
        db.saveFocusSession(u);
        get().loadFocusSessions();
        stopAmbient();
        if (get().settings.soundEnabled) playSound('complete');
        if (get().settings.vibrationEnabled) vibrate([200, 100, 200, 100, 300]);
        if (Notification.permission === 'granted') {
          new Notification('MindGuard', { body: 'Фокус-сессия завершена! 🎉', icon: '/pwa-192x192.png' });
        }
      } else {
        set({ currentFocusSession: { ...s, remainingSeconds: remaining } });
      }
    }
  },
  setAmbientSound: (sound) => {
    set({ currentAmbient: sound });
    playAmbient(sound);
    const s = get().currentFocusSession;
    if (s) {
      const u = { ...s, ambientSound: sound };
      set({ currentFocusSession: u });
      db.saveFocusSession(u);
    }
  },

  // ── Blocker ──
  loadBlockRules: async () => {
    let rules = await db.getAllBlockRules();
    if (rules.length === 0) {
      rules = getDefaultBlockRules();
      for (const r of rules) await db.saveBlockRule(r);
    }
    // Migrate old rules without strictness
    rules = rules.map(r => ({ ...r, strictness: r.strictness || 'normal' }));
    set({ blockRules: rules });
  },
  saveBlockRule: async (r) => { await db.saveBlockRule(r); await get().loadBlockRules(); },
  deleteBlockRule: async (id) => { await db.deleteBlockRule(id); await get().loadBlockRules(); },
  loadBlockAttempts: async () => { set({ blockAttempts: await db.getAllBlockAttempts() }); },
  saveBlockAttempt: async (a) => { await db.saveBlockAttempt(a); await get().loadBlockAttempts(); },

  checkUrl: (url: string) => {
    const { blockRules, settings } = get();
    if (!settings.blockerEnabled) return { blocked: false, rule: null, mode: '', strictness: '' };
    const lowerUrl = url.toLowerCase();
    let hostname = '';
    try { hostname = new URL(lowerUrl.startsWith('http') ? lowerUrl : `https://${lowerUrl}`).hostname; }
    catch { hostname = lowerUrl; }

    for (const rule of blockRules) {
      if (!rule.enabled) continue;
      // Schedule check
      if (rule.schedule?.enabled) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = rule.schedule.startTime.split(':').map(Number);
        const [eh, em] = rule.schedule.endTime.split(':').map(Number);
        const startMin = sh * 60 + sm; const endMin = eh * 60 + em;
        if (startMin <= endMin) {
          if (nowMin < startMin || nowMin > endMin) continue;
        } else { // overnight schedule
          if (nowMin < startMin && nowMin > endMin) continue;
        }
        if (!rule.schedule.days.includes(now.getDay())) continue;
      }
      let matched = false;
      for (const t of rule.targets) {
        if (t.type === 'domain' && hostname.includes(t.value)) { matched = true; break; }
        if (t.type === 'keyword' && lowerUrl.includes(t.value.toLowerCase())) { matched = true; break; }
        if (t.type === 'path' && lowerUrl.includes(t.value.toLowerCase())) { matched = true; break; }
      }
      if (matched) return { blocked: true, rule, mode: rule.mode, strictness: rule.strictness || 'normal' };
    }
    return { blocked: false, rule: null, mode: '', strictness: '' };
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

  // ── Sound/Vibration helpers ──
  playSound: (type) => { if (get().settings.soundEnabled) playSound(type); },
  vibrate: (pattern) => { if (get().settings.vibrationEnabled) vibrate(pattern); },
}));

// ── Theme ──
function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  const setTheme = (t: string) => root.setAttribute('data-theme', t);

  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', (e) => setTheme(e.matches ? 'dark' : 'light'));
  } else {
    setTheme(theme);
  }
}

// ── Helpers ──
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
