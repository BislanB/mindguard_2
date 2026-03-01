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

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, t);
  master.gain.linearRampToValueAtTime(0.6, t + 0.5);
  master.connect(ctx.destination);
  ambientNodes.push(master);

  const noiseBuf = createNoiseBuffer(ctx, 4);

  if (sound === 'whitenoise') {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf; n.loop = true;
    n.connect(master); n.start();
    ambientNodes.push(n);

  } else if (sound === 'rain') {
    // RAIN: high hiss + low distant rumble
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf; n.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1000;
    const g = ctx.createGain(); g.gain.value = 0.5;
    n.connect(hp).connect(g).connect(master); n.start();
    const n2 = ctx.createBufferSource();
    n2.buffer = createNoiseBuffer(ctx, 6); n2.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 120;
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    n2.connect(lp).connect(g2).connect(master); n2.start();
    ambientNodes.push(n, hp, g, n2, lp, g2);

  } else if (sound === 'waves') {
    // WAVES: dramatic volume swells — silence to loud, like real ocean
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf; n.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2;
    const waveGain = ctx.createGain();
    waveGain.gain.value = 0; // starts silent
    // Deep LFO: goes from 0 to 0.7 volume
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.08; // 12-second cycle
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5; // huge depth
    lfo.connect(lfoDepth).connect(waveGain.gain);
    // Second LFO for variation
    const lfo2 = ctx.createOscillator();
    lfo2.type = 'sine'; lfo2.frequency.value = 0.13;
    const lfo2Depth = ctx.createGain();
    lfo2Depth.gain.value = 0.2;
    lfo2.connect(lfo2Depth).connect(waveGain.gain);
    n.connect(lp).connect(waveGain).connect(master);
    n.start(); lfo.start(); lfo2.start();
    ambientNodes.push(n, lp, waveGain, lfo, lfoDepth, lfo2, lfo2Depth);

  } else if (sound === 'forest') {
    // FOREST: birds are the STAR — loud chirps + quiet wind
    // Quiet wind base
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf; n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 1;
    const windG = ctx.createGain(); windG.gain.value = 0.08;
    n.connect(bp).connect(windG).connect(master); n.start();
    ambientNodes.push(n, bp, windG);
    // LOUD birds — 3 different "species" with vibrato
    const birdFreqs = [1800, 2800, 3500];
    const birdSpeeds = [5, 8, 6]; // vibrato speed
    const birdRhythms = [0.15, 0.22, 0.08]; // rhythm (how often they "sing")
    for (let b = 0; b < 3; b++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = birdFreqs[b];
      // Vibrato (pitch wobble)
      const vib = ctx.createOscillator();
      vib.type = 'sine'; vib.frequency.value = birdSpeeds[b];
      const vibG = ctx.createGain();
      vibG.gain.value = birdFreqs[b] * 0.05; // 5% pitch wobble
      vib.connect(vibG).connect(osc.frequency);
      // Rhythm: on-off pattern
      const rhythmLfo = ctx.createOscillator();
      rhythmLfo.type = 'sine'; rhythmLfo.frequency.value = birdRhythms[b];
      const birdGain = ctx.createGain();
      birdGain.gain.value = 0;
      const rhythmDepth = ctx.createGain();
      rhythmDepth.gain.value = 0.08; // loud birds!
      rhythmLfo.connect(rhythmDepth).connect(birdGain.gain);
      osc.connect(birdGain).connect(master);
      osc.start(); vib.start(); rhythmLfo.start();
      ambientNodes.push(osc, vib, vibG, rhythmLfo, birdGain, rhythmDepth);
    }

  } else if (sound === 'fire') {
    // FIRE: deep bass drone + sharp crackle pops
    // Deep warm drone
    const drone = ctx.createOscillator();
    drone.type = 'sine'; drone.frequency.value = 60;
    const droneG = ctx.createGain(); droneG.gain.value = 0.2;
    drone.connect(droneG).connect(master); drone.start();
    // Second harmonic
    const drone2 = ctx.createOscillator();
    drone2.type = 'triangle'; drone2.frequency.value = 120;
    const drone2G = ctx.createGain(); drone2G.gain.value = 0.08;
    drone2.connect(drone2G).connect(master); drone2.start();
    // Crackle: LOUD high-frequency noise bursts
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf; n.loop = true;
    const crackHp = ctx.createBiquadFilter();
    crackHp.type = 'highpass'; crackHp.frequency.value = 5000;
    const crackG = ctx.createGain(); crackG.gain.value = 0;
    // Fast random-ish modulation
    const snap = ctx.createOscillator();
    snap.type = 'sawtooth'; snap.frequency.value = 11;
    const snapG = ctx.createGain(); snapG.gain.value = 0.25;
    snap.connect(snapG).connect(crackG.gain);
    n.connect(crackHp).connect(crackG).connect(master);
    n.start(); snap.start();
    // Low rumble noise
    const n2 = ctx.createBufferSource();
    n2.buffer = createNoiseBuffer(ctx, 5); n2.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 100;
    const rumG = ctx.createGain(); rumG.gain.value = 0.15;
    n2.connect(lp).connect(rumG).connect(master); n2.start();
    ambientNodes.push(drone, droneG, drone2, drone2G, n, crackHp, crackG, snap, snapG, n2, lp, rumG);

  } else if (sound === 'cafe') {
    // CAFE: voice-like murmur (mid frequencies) + cup/glass clinking
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf; n.loop = true;
    // Voice range: 300-800 Hz bandpass
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 2;
    const murmG = ctx.createGain(); murmG.gain.value = 0.3;
    // Slow speech-like modulation
    const speechLfo = ctx.createOscillator();
    speechLfo.type = 'sine'; speechLfo.frequency.value = 3;
    const speechDepth = ctx.createGain();
    speechDepth.gain.value = 0.15;
    speechLfo.connect(speechDepth).connect(murmG.gain);
    n.connect(bp).connect(murmG).connect(master);
    n.start(); speechLfo.start();
    // Clinking: prominent high tones
    const clink = ctx.createOscillator();
    clink.type = 'sine'; clink.frequency.value = 2200;
    const clink2 = ctx.createOscillator();
    clink2.type = 'sine'; clink2.frequency.value = 3100;
    const clinkG = ctx.createGain(); clinkG.gain.value = 0;
    // Periodic ding pattern
    const dingLfo = ctx.createOscillator();
    dingLfo.type = 'square'; dingLfo.frequency.value = 0.5;
    const dingDepth = ctx.createGain();
    dingDepth.gain.value = 0.025;
    dingLfo.connect(dingDepth).connect(clinkG.gain);
    clink.connect(clinkG); clink2.connect(clinkG);
    clinkG.connect(master);
    clink.start(); clink2.start(); dingLfo.start();
    ambientNodes.push(n, bp, murmG, speechLfo, speechDepth, clink, clink2, clinkG, dingLfo, dingDepth);
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
