import { create } from 'zustand';
import type {
  DailyEntry, JournalEntry, Goal, FocusSession,
  BlockRule, BlockAttempt, UserSettings, StreakMilestone, AmbientSound, AppTheme,
} from '../types/index.js';
import { STREAK_MILESTONES } from '../types/index.js';
import * as db from '../db/index.js';
import { v4 as uuid } from 'uuid';

// ── Ambient Sound Engine (Web Audio API nodes) ──
let ambientCtx: AudioContext | null = null;
let ambientNodes: AudioNode[] = [];

function stopAmbient() {
  for (const n of ambientNodes) {
    try { if ('stop' in n && typeof (n as any).stop === 'function') (n as any).stop(); } catch { }
    try { n.disconnect(); } catch { }
  }
  ambientNodes = [];
}

function createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

async function playAmbient(sound: AmbientSound) {
  stopAmbient();
  if (sound === 'none') return;

  if (!ambientCtx) ambientCtx = new AudioContext();
  if (ambientCtx.state === 'suspended') await ambientCtx.resume();
  const ctx = ambientCtx;
  const t = ctx.currentTime;

  // Master gain with fade-in
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, t);
  master.gain.linearRampToValueAtTime(0.5, t + 0.8);
  master.connect(ctx.destination);
  ambientNodes.push(master);

  if (sound === 'whitenoise') {
    // Pure white noise — simple and clean
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 4);
    noise.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.4;
    noise.connect(g).connect(master);
    noise.start();
    ambientNodes.push(noise, g);

  } else if (sound === 'rain') {
    // RAIN: highpass-filtered noise (hiss) + pink noise layer
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 6);
    noise.loop = true;
    // Highpass for rain "hiss"
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;
    hp.Q.value = 0.5;
    const g1 = ctx.createGain();
    g1.gain.value = 0.35;
    noise.connect(hp).connect(g1).connect(master);
    noise.start();
    // Low rumble layer (distant thunder)
    const noise2 = ctx.createBufferSource();
    noise2.buffer = createNoiseBuffer(ctx, 8);
    noise2.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 150;
    const g2 = ctx.createGain();
    g2.gain.value = 0.15;
    noise2.connect(lp).connect(g2).connect(master);
    noise2.start();
    ambientNodes.push(noise, hp, g1, noise2, lp, g2);

  } else if (sound === 'waves') {
    // WAVES: noise modulated by slow LFO (amplitude goes up and down like waves)
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 10);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = 400;
    bp.Q.value = 1;
    // LFO to modulate amplitude (wave rhythm)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12; // ~8 second wave cycle
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.25;
    const waveGain = ctx.createGain();
    waveGain.gain.value = 0.3;
    lfo.connect(lfoGain).connect(waveGain.gain);
    noise.connect(bp).connect(waveGain).connect(master);
    lfo.start();
    noise.start();
    // High hiss layer (foam)
    const foam = ctx.createBufferSource();
    foam.buffer = createNoiseBuffer(ctx, 5);
    foam.loop = true;
    const foamHp = ctx.createBiquadFilter();
    foamHp.type = 'highpass';
    foamHp.frequency.value = 2000;
    const foamGain = ctx.createGain();
    foamGain.gain.value = 0.08;
    const foamLfo = ctx.createGain();
    foamLfo.gain.value = 0.06;
    lfo.connect(foamLfo).connect(foamGain.gain);
    foam.connect(foamHp).connect(foamGain).connect(master);
    foam.start();
    ambientNodes.push(noise, bp, lfo, lfoGain, waveGain, foam, foamHp, foamGain, foamLfo);

  } else if (sound === 'forest') {
    // FOREST: very gentle wind (bandpass noise) + bird chirps (high oscillators)
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 8);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 300;
    bp.Q.value = 0.3;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.12;
    noise.connect(bp).connect(windGain).connect(master);
    noise.start();
    // Bird chirps: multiple high-frequency oscillators with tremolo
    for (let b = 0; b < 3; b++) {
      const bird = ctx.createOscillator();
      bird.type = 'sine';
      bird.frequency.value = 2500 + b * 800; // 2500, 3300, 4100 Hz
      // Tremolo (on-off modulation)
      const trem = ctx.createOscillator();
      trem.type = 'square';
      trem.frequency.value = 3 + b * 2; // fast on-off
      const tremGain = ctx.createGain();
      tremGain.gain.value = 0.02; // quiet birds
      const birdGain = ctx.createGain();
      birdGain.gain.value = 0;
      trem.connect(tremGain).connect(birdGain.gain);
      bird.connect(birdGain).connect(master);
      // Random volume envelope via slow LFO
      const env = ctx.createOscillator();
      env.type = 'sine';
      env.frequency.value = 0.05 + b * 0.03; // very slow
      const envGain = ctx.createGain();
      envGain.gain.value = 0.015;
      env.connect(envGain).connect(birdGain.gain);
      bird.start(); trem.start(); env.start();
      ambientNodes.push(bird, trem, tremGain, birdGain, env, envGain);
    }
    // Leaves rustling: very high bandpass noise
    const leaves = ctx.createBufferSource();
    leaves.buffer = createNoiseBuffer(ctx, 5);
    leaves.loop = true;
    const leavesBp = ctx.createBiquadFilter();
    leavesBp.type = 'highpass';
    leavesBp.frequency.value = 3000;
    const leavesGain = ctx.createGain();
    leavesGain.gain.value = 0.04;
    leaves.connect(leavesBp).connect(leavesGain).connect(master);
    leaves.start();
    ambientNodes.push(noise, bp, windGain, leaves, leavesBp, leavesGain);

  } else if (sound === 'fire') {
    // FIRE: low rumble + crackle (lowpass noise + sharp filtered bursts)
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 6);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    lp.Q.value = 2;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.35;
    noise.connect(lp).connect(rumbleGain).connect(master);
    noise.start();
    // Crackle: highpass noise with random volume envelope
    const crack = ctx.createBufferSource();
    crack.buffer = createNoiseBuffer(ctx, 8);
    crack.loop = true;
    const crackHp = ctx.createBiquadFilter();
    crackHp.type = 'highpass';
    crackHp.frequency.value = 4000;
    const crackGain = ctx.createGain();
    crackGain.gain.value = 0.15;
    // Modulate crackle volume randomly
    const crackLfo = ctx.createOscillator();
    crackLfo.type = 'sawtooth';
    crackLfo.frequency.value = 7;
    const crackLfoGain = ctx.createGain();
    crackLfoGain.gain.value = 0.1;
    crackLfo.connect(crackLfoGain).connect(crackGain.gain);
    crack.connect(crackHp).connect(crackGain).connect(master);
    crack.start(); crackLfo.start();
    // Mid warmth
    const warm = ctx.createOscillator();
    warm.type = 'sine';
    warm.frequency.value = 80;
    const warmGain = ctx.createGain();
    warmGain.gain.value = 0.06;
    warm.connect(warmGain).connect(master);
    warm.start();
    ambientNodes.push(noise, lp, rumbleGain, crack, crackHp, crackGain, crackLfo, crackLfoGain, warm, warmGain);

  } else if (sound === 'cafe') {
    // CAFE: mid-frequency murmur + distinct high clinking
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 8);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.8;
    const murmurGain = ctx.createGain();
    murmurGain.gain.value = 0.25;
    noise.connect(bp).connect(murmurGain).connect(master);
    noise.start();
    // Voice-like modulation
    const voiceLfo = ctx.createOscillator();
    voiceLfo.type = 'sine';
    voiceLfo.frequency.value = 0.4;
    const voiceLfoGain = ctx.createGain();
    voiceLfoGain.gain.value = 0.1;
    voiceLfo.connect(voiceLfoGain).connect(murmurGain.gain);
    voiceLfo.start();
    // Clinking sounds: high sine oscillators
    const clink1 = ctx.createOscillator();
    clink1.type = 'sine';
    clink1.frequency.value = 3800;
    const clink2 = ctx.createOscillator();
    clink2.type = 'sine';
    clink2.frequency.value = 4200;
    const clinkGain = ctx.createGain();
    clinkGain.gain.value = 0;
    const clinkLfo = ctx.createOscillator();
    clinkLfo.type = 'square';
    clinkLfo.frequency.value = 0.3; // occasional dings
    const clinkLfoGain = ctx.createGain();
    clinkLfoGain.gain.value = 0.012;
    clinkLfo.connect(clinkLfoGain).connect(clinkGain.gain);
    clink1.connect(clinkGain);
    clink2.connect(clinkGain);
    clinkGain.connect(master);
    clink1.start(); clink2.start(); clinkLfo.start();
    ambientNodes.push(noise, bp, murmurGain, voiceLfo, voiceLfoGain, clink1, clink2, clinkGain, clinkLfo, clinkLfoGain);
  }
}

// ── Sound Effects ──
async function playSound(type: 'complete' | 'click' | 'success' | 'warning') {
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.value = 0.3;
    if (type === 'complete') {
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'click') {
      osc.frequency.value = 800; gain.gain.value = 0.15;
      osc.start(); osc.stop(ctx.currentTime + 0.06);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.value = 300; osc.type = 'square'; gain.gain.value = 0.2;
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    }
    // Cleanup after sound plays
    osc.onended = () => ctx.close();
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
