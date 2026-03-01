import { openDB, type IDBPDatabase } from 'idb';
import type {
  DailyEntry,
  JournalEntry,
  Goal,
  FocusSession,
  BlockRule,
  BlockAttempt,
  UserSettings,
} from '../types/index.js';

const DB_NAME = 'mindguard-v2';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Daily entries
        if (!db.objectStoreNames.contains('entries')) {
          const store = db.createObjectStore('entries', { keyPath: 'id' });
          store.createIndex('by-date', 'date', { unique: false });
        }
        // Journal
        if (!db.objectStoreNames.contains('journal')) {
          const store = db.createObjectStore('journal', { keyPath: 'id' });
          store.createIndex('by-date', 'date', { unique: false });
        }
        // Goals
        if (!db.objectStoreNames.contains('goals')) {
          db.createObjectStore('goals', { keyPath: 'id' });
        }
        // Focus sessions
        if (!db.objectStoreNames.contains('focusSessions')) {
          const store = db.createObjectStore('focusSessions', { keyPath: 'id' });
          store.createIndex('by-started', 'startedAt', { unique: false });
        }
        // Block rules
        if (!db.objectStoreNames.contains('blockRules')) {
          db.createObjectStore('blockRules', { keyPath: 'id' });
        }
        // Block attempts
        if (!db.objectStoreNames.contains('blockAttempts')) {
          const store = db.createObjectStore('blockAttempts', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp', { unique: false });
        }
        // Settings
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

// ── Default Settings ──

export function getDefaultSettings(): UserSettings {
  return {
    theme: 'dark',
    notificationsEnabled: false,
    reminderTime: '21:00',
    onboardingCompleted: false,
    lastStreakCelebration: 0,
    lastSeenWeeklySummary: null,
    blockerEnabled: true,
    blockerPin: '',
  };
}

// ── Entries ──

export async function getAllEntries(): Promise<DailyEntry[]> {
  try {
    const db = await getDB();
    return db.getAll('entries');
  } catch (e) { console.error('DB: getAllEntries failed', e); return []; }
}

export async function getEntryByDate(date: string): Promise<DailyEntry | undefined> {
  try {
    const db = await getDB();
    const all = await db.getAllFromIndex('entries', 'by-date', date);
    return all[0];
  } catch (e) { console.error('DB: getEntryByDate failed', e); return undefined; }
}

export async function saveEntry(entry: DailyEntry): Promise<void> {
  try {
    const db = await getDB();
    await db.put('entries', entry);
  } catch (e) { console.error('DB: saveEntry failed', e); }
}

export async function deleteEntry(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('entries', id);
  } catch (e) { console.error('DB: deleteEntry failed', e); }
}

// ── Journal ──

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
  try {
    const db = await getDB();
    return db.getAll('journal');
  } catch (e) { console.error('DB: getAllJournalEntries failed', e); return []; }
}

export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  try {
    const db = await getDB();
    await db.put('journal', entry);
  } catch (e) { console.error('DB: saveJournalEntry failed', e); }
}

export async function deleteJournalEntry(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('journal', id);
  } catch (e) { console.error('DB: deleteJournalEntry failed', e); }
}

// ── Goals ──

export async function getAllGoals(): Promise<Goal[]> {
  try {
    const db = await getDB();
    return db.getAll('goals');
  } catch (e) { console.error('DB: getAllGoals failed', e); return []; }
}

export async function saveGoal(goal: Goal): Promise<void> {
  try {
    const db = await getDB();
    await db.put('goals', goal);
  } catch (e) { console.error('DB: saveGoal failed', e); }
}

export async function deleteGoal(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('goals', id);
  } catch (e) { console.error('DB: deleteGoal failed', e); }
}

// ── Focus Sessions ──

export async function getAllFocusSessions(): Promise<FocusSession[]> {
  try {
    const db = await getDB();
    return db.getAll('focusSessions');
  } catch (e) { console.error('DB: getAllFocusSessions failed', e); return []; }
}

export async function saveFocusSession(session: FocusSession): Promise<void> {
  try {
    const db = await getDB();
    await db.put('focusSessions', session);
  } catch (e) { console.error('DB: saveFocusSession failed', e); }
}

// ── Block Rules ──

export async function getAllBlockRules(): Promise<BlockRule[]> {
  try {
    const db = await getDB();
    return db.getAll('blockRules');
  } catch (e) { console.error('DB: getAllBlockRules failed', e); return []; }
}

export async function saveBlockRule(rule: BlockRule): Promise<void> {
  try {
    const db = await getDB();
    await db.put('blockRules', rule);
  } catch (e) { console.error('DB: saveBlockRule failed', e); }
}

export async function deleteBlockRule(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('blockRules', id);
  } catch (e) { console.error('DB: deleteBlockRule failed', e); }
}

// ── Block Attempts ──

export async function getAllBlockAttempts(): Promise<BlockAttempt[]> {
  try {
    const db = await getDB();
    return db.getAll('blockAttempts');
  } catch (e) { console.error('DB: getAllBlockAttempts failed', e); return []; }
}

export async function saveBlockAttempt(attempt: BlockAttempt): Promise<void> {
  try {
    const db = await getDB();
    await db.put('blockAttempts', attempt);
  } catch (e) { console.error('DB: saveBlockAttempt failed', e); }
}

// ── Settings ──

export async function getSettings(): Promise<UserSettings> {
  try {
    const db = await getDB();
    const s = await db.get('settings', 'main');
    return s ?? getDefaultSettings();
  } catch (e) { console.error('DB: getSettings failed', e); return getDefaultSettings(); }
}

export async function saveSettings(s: UserSettings): Promise<void> {
  try {
    const db = await getDB();
    await db.put('settings', s, 'main');
  } catch (e) { console.error('DB: saveSettings failed', e); }
}

// ── Bulk export / import ──

export async function exportAllData() {
  return {
    entries: await getAllEntries(),
    journal: await getAllJournalEntries(),
    goals: await getAllGoals(),
    focusSessions: await getAllFocusSessions(),
    blockRules: await getAllBlockRules(),
    blockAttempts: await getAllBlockAttempts(),
    settings: await getSettings(),
    exportedAt: new Date().toISOString(),
    version: 2,
  };
}

export async function importAllData(data: any): Promise<boolean> {
  try {
    const db = await getDB();

    if (data.entries && Array.isArray(data.entries)) {
      const tx = db.transaction('entries', 'readwrite');
      for (const e of data.entries) await tx.store.put(e);
      await tx.done;
    }
    if (data.journal && Array.isArray(data.journal)) {
      const tx = db.transaction('journal', 'readwrite');
      for (const e of data.journal) await tx.store.put(e);
      await tx.done;
    }
    if (data.goals && Array.isArray(data.goals)) {
      const tx = db.transaction('goals', 'readwrite');
      for (const g of data.goals) await tx.store.put(g);
      await tx.done;
    }
    if (data.focusSessions && Array.isArray(data.focusSessions)) {
      const tx = db.transaction('focusSessions', 'readwrite');
      for (const s of data.focusSessions) await tx.store.put(s);
      await tx.done;
    }
    if (data.blockRules && Array.isArray(data.blockRules)) {
      const tx = db.transaction('blockRules', 'readwrite');
      for (const r of data.blockRules) await tx.store.put(r);
      await tx.done;
    }
    if (data.blockAttempts && Array.isArray(data.blockAttempts)) {
      const tx = db.transaction('blockAttempts', 'readwrite');
      for (const a of data.blockAttempts) await tx.store.put(a);
      await tx.done;
    }
    if (data.settings) {
      await db.put('settings', data.settings, 'main');
    }
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
}

export async function clearAllData(): Promise<void> {
  const names = ['entries', 'journal', 'goals', 'focusSessions', 'blockRules', 'blockAttempts', 'settings'];
  const db = await getDB();
  for (const name of names) {
    const tx = db.transaction(name, 'readwrite');
    await tx.store.clear();
    await tx.done;
  }
}
