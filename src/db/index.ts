import { openDB, type IDBPDatabase } from 'idb';
import type {
  DailyEntry, JournalEntry, Goal, FocusSession,
  BlockRule, BlockAttempt, UserSettings,
} from '../types/index.js';

const DB_NAME = 'mindguard-v2';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('entries')) {
          const s = db.createObjectStore('entries', { keyPath: 'id' });
          s.createIndex('by-date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('journal')) {
          const s = db.createObjectStore('journal', { keyPath: 'id' });
          s.createIndex('by-date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('goals')) db.createObjectStore('goals', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('focusSessions')) {
          const s = db.createObjectStore('focusSessions', { keyPath: 'id' });
          s.createIndex('by-started', 'startedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('blockRules')) db.createObjectStore('blockRules', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('blockAttempts')) {
          const s = db.createObjectStore('blockAttempts', { keyPath: 'id' });
          s.createIndex('by-timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
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
    morningReminderTime: '08:00',
    eveningReminderTime: '21:00',
    morningCheckIn: false,
    eveningCheckIn: false,
    onboardingCompleted: false,
    lastStreakCelebration: 0,
    lastSeenWeeklySummary: null,
    blockerEnabled: true,
    blockerPin: '',
    soundEnabled: true,
    vibrationEnabled: true,
  };
}

// ── Entries ──
export async function getAllEntries(): Promise<DailyEntry[]> {
  try { const db = await getDB(); return db.getAll('entries'); }
  catch (e) { console.error('DB: getAllEntries', e); return []; }
}
export async function getEntryByDate(date: string): Promise<DailyEntry | undefined> {
  try {
    const db = await getDB();
    const all = await db.getAllFromIndex('entries', 'by-date', date);
    return all[0];
  } catch (e) { console.error('DB: getEntryByDate', e); return undefined; }
}
export async function saveEntry(entry: DailyEntry): Promise<void> {
  try { const db = await getDB(); await db.put('entries', entry); }
  catch (e) { console.error('DB: saveEntry', e); }
}
export async function deleteEntry(id: string): Promise<void> {
  try { const db = await getDB(); await db.delete('entries', id); }
  catch (e) { console.error('DB: deleteEntry', e); }
}

// ── Journal ──
export async function getAllJournalEntries(): Promise<JournalEntry[]> {
  try { const db = await getDB(); return db.getAll('journal'); }
  catch (e) { console.error('DB: getAllJournal', e); return []; }
}
export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  try { const db = await getDB(); await db.put('journal', entry); }
  catch (e) { console.error('DB: saveJournal', e); }
}
export async function deleteJournalEntry(id: string): Promise<void> {
  try { const db = await getDB(); await db.delete('journal', id); }
  catch (e) { console.error('DB: deleteJournal', e); }
}

// ── Goals ──
export async function getAllGoals(): Promise<Goal[]> {
  try { const db = await getDB(); return db.getAll('goals'); }
  catch (e) { console.error('DB: getAllGoals', e); return []; }
}
export async function saveGoal(goal: Goal): Promise<void> {
  try { const db = await getDB(); await db.put('goals', goal); }
  catch (e) { console.error('DB: saveGoal', e); }
}
export async function deleteGoal(id: string): Promise<void> {
  try { const db = await getDB(); await db.delete('goals', id); }
  catch (e) { console.error('DB: deleteGoal', e); }
}

// ── Focus Sessions ──
export async function getAllFocusSessions(): Promise<FocusSession[]> {
  try { const db = await getDB(); return db.getAll('focusSessions'); }
  catch (e) { console.error('DB: getAllFocus', e); return []; }
}
export async function saveFocusSession(session: FocusSession): Promise<void> {
  try { const db = await getDB(); await db.put('focusSessions', session); }
  catch (e) { console.error('DB: saveFocus', e); }
}

// ── Block Rules ──
export async function getAllBlockRules(): Promise<BlockRule[]> {
  try { const db = await getDB(); return db.getAll('blockRules'); }
  catch (e) { console.error('DB: getAllBlockRules', e); return []; }
}
export async function saveBlockRule(rule: BlockRule): Promise<void> {
  try { const db = await getDB(); await db.put('blockRules', rule); }
  catch (e) { console.error('DB: saveBlockRule', e); }
}
export async function deleteBlockRule(id: string): Promise<void> {
  try { const db = await getDB(); await db.delete('blockRules', id); }
  catch (e) { console.error('DB: deleteBlockRule', e); }
}

// ── Block Attempts ──
export async function getAllBlockAttempts(): Promise<BlockAttempt[]> {
  try { const db = await getDB(); return db.getAll('blockAttempts'); }
  catch (e) { console.error('DB: getAllBlockAttempts', e); return []; }
}
export async function saveBlockAttempt(attempt: BlockAttempt): Promise<void> {
  try { const db = await getDB(); await db.put('blockAttempts', attempt); }
  catch (e) { console.error('DB: saveBlockAttempt', e); }
}

// ── Settings ──
export async function getSettings(): Promise<UserSettings> {
  try {
    const db = await getDB();
    const s = await db.get('settings', 'main');
    if (!s) return getDefaultSettings();
    // Merge with defaults for forward-compatibility
    return { ...getDefaultSettings(), ...s };
  } catch (e) { console.error('DB: getSettings', e); return getDefaultSettings(); }
}
export async function saveSettings(s: UserSettings): Promise<void> {
  try { const db = await getDB(); await db.put('settings', s, 'main'); }
  catch (e) { console.error('DB: saveSettings', e); }
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
    const stores = ['entries', 'journal', 'goals', 'focusSessions', 'blockRules', 'blockAttempts'] as const;
    for (const name of stores) {
      if (data[name] && Array.isArray(data[name])) {
        const tx = db.transaction(name, 'readwrite');
        for (const item of data[name]) await tx.store.put(item);
        await tx.done;
      }
    }
    if (data.settings) await db.put('settings', data.settings, 'main');
    return true;
  } catch (e) { console.error('Import failed:', e); return false; }
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
