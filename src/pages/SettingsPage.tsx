import { useState } from 'react';
import { useAppStore } from '../store/index.js';
import { Modal, ConfirmModal } from '../components/common/Modal.js';
import { v4 as uuid } from 'uuid';
import type { Goal, GoalMetric } from '../types/index.js';
import * as db from '../db/index.js';

const GOAL_PRESETS: Array<{ metric: GoalMetric; label: string; emoji: string; target: number; comparison: 'gte' | 'lte'; period: 'daily' | 'weekly' }> = [
  { metric: 'sleep', label: 'Сон ≥ 7 часов', emoji: '😴', target: 7, comparison: 'gte', period: 'daily' },
  { metric: 'stress', label: 'Стресс ≤ 5', emoji: '😰', target: 5, comparison: 'lte', period: 'daily' },
  { metric: 'mood', label: 'Настроение ≥ 7', emoji: '😊', target: 7, comparison: 'gte', period: 'daily' },
  { metric: 'energy', label: 'Энергия ≥ 6', emoji: '⚡', target: 6, comparison: 'gte', period: 'daily' },
  { metric: 'deepWork', label: 'Глуб. работа ≥ 4ч', emoji: '🎯', target: 4, comparison: 'gte', period: 'daily' },
  { metric: 'streak', label: 'Серия 30 дней', emoji: '🔥', target: 30, comparison: 'gte', period: 'weekly' },
];

export function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const goals = useAppStore((s) => s.goals);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const saveGoal = useAppStore((s) => s.saveGoal);
  const deleteGoal = useAppStore((s) => s.deleteGoal);

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Export
  const handleExport = async () => {
    const data = await db.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindguard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const success = await db.importAllData(data);
        if (success) {
          setImportResult('✅ Данные импортированы! Перезагрузите страницу.');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setImportResult('❌ Ошибка импорта');
        }
      } catch {
        setImportResult('❌ Неверный формат файла');
      }
    };
    input.click();
  };

  // Notification permission
  const handleNotifications = async () => {
    if (!settings.notificationsEnabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updateSettings({ notificationsEnabled: true });
        // Schedule reminder
        if ('serviceWorker' in navigator) {
          new Notification('MindGuard', { body: 'Уведомления включены! 🔔', icon: '/pwa-192x192.png' });
        }
      }
    } else {
      updateSettings({ notificationsEnabled: false });
    }
  };

  // Clear data
  const handleClear = async () => {
    await db.clearAllData();
    window.location.reload();
  };

  const addGoal = (preset: typeof GOAL_PRESETS[0]) => {
    const goal: Goal = {
      id: uuid(),
      metric: preset.metric,
      target: preset.target,
      comparison: preset.comparison,
      label: preset.label,
      emoji: preset.emoji,
      period: preset.period,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    saveGoal(goal);
    setShowGoalModal(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">Настройки</h1>
      </div>

      {/* Theme */}
      <div className="settings-section">
        <div className="settings-section__title">Оформление</div>
        <div className="settings-row" style={{ borderRadius: 'var(--radius)' }}>
          <span className="settings-row__label">Тема</span>
          <div className="tabs" style={{ margin: 0, width: 200 }}>
            {(['dark', 'light', 'system'] as const).map((t) => (
              <button key={t}
                className={`tabs__item${settings.theme === t ? ' tabs__item--active' : ''}`}
                style={{ padding: '6px 8px', fontSize: 12 }}
                onClick={() => updateSettings({ theme: t })}>
                {t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '⚙️'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="settings-section">
        <div className="settings-section__title">Уведомления</div>
        <div className="settings-row" style={{ borderRadius: 'var(--radius) var(--radius) 0 0' }}>
          <span className="settings-row__label">Напоминание об отчёте</span>
          <div className="toggle" onClick={handleNotifications}>
            <div className="toggle__track" style={settings.notificationsEnabled ? { background: 'var(--accent)' } : {}}>
              <div className="toggle__thumb" style={settings.notificationsEnabled ? { transform: 'translateX(20px)' } : {}} />
            </div>
          </div>
        </div>
        {settings.notificationsEnabled && (
          <div className="settings-row" style={{ borderRadius: '0 0 var(--radius) var(--radius)' }}>
            <span className="settings-row__label">Время</span>
            <input className="input input--sm" type="time" value={settings.reminderTime}
              onChange={(e) => updateSettings({ reminderTime: e.target.value })}
              style={{ width: 90, textAlign: 'center' }} />
          </div>
        )}
      </div>

      {/* Goals */}
      <div className="settings-section">
        <div className="settings-section__title">Цели</div>
        {goals.map((g) => (
          <div key={g.id} className="settings-row">
            <span className="settings-row__label">{g.emoji} {g.label}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="toggle" onClick={() => saveGoal({ ...g, enabled: !g.enabled })}>
                <div className="toggle__track" style={g.enabled ? { background: 'var(--accent)' } : {}}>
                  <div className="toggle__thumb" style={g.enabled ? { transform: 'translateX(20px)' } : {}} />
                </div>
              </div>
              <button className="btn btn--ghost btn--sm" style={{ color: 'var(--danger)', padding: '4px' }}
                onClick={() => deleteGoal(g.id)}>✕</button>
            </div>
          </div>
        ))}
        <button className="btn btn--secondary mt-8" style={{ width: '100%' }}
          onClick={() => setShowGoalModal(true)}>
          + Добавить цель
        </button>
      </div>

      {/* Data */}
      <div className="settings-section">
        <div className="settings-section__title">Данные</div>
        <div className="settings-row" style={{ borderRadius: 'var(--radius) var(--radius) 0 0' }} onClick={handleExport}>
          <span className="settings-row__label">Экспорт</span>
          <span className="settings-row__value">JSON →</span>
        </div>
        <div className="settings-row" onClick={handleImport}>
          <span className="settings-row__label">Импорт</span>
          <span className="settings-row__value">JSON ←</span>
        </div>
        <div className="settings-row" style={{ borderRadius: '0 0 var(--radius) var(--radius)' }}
          onClick={() => setShowClearConfirm(true)}>
          <span className="settings-row__label" style={{ color: 'var(--danger)' }}>Очистить все данные</span>
        </div>
      </div>

      {importResult && (
        <div className="card mb-16" style={{ textAlign: 'center', fontSize: 14 }}>
          {importResult}
        </div>
      )}

      {/* About */}
      <div className="settings-section">
        <div className="settings-section__title">О приложении</div>
        <div className="settings-row" style={{ borderRadius: 'var(--radius)' }}>
          <span className="settings-row__label">MindGuard</span>
          <span className="settings-row__value">v2.0.0</span>
        </div>
      </div>

      {/* Goal Picker Modal */}
      {showGoalModal && (
        <Modal open onClose={() => setShowGoalModal(false)} title="Выберите цель">
          {GOAL_PRESETS.filter(p => !goals.some(g => g.metric === p.metric)).map((preset, i) => (
            <div key={i} className="settings-row" style={{ borderRadius: 'var(--radius)', marginBottom: 8 }}
              onClick={() => addGoal(preset)}>
              <span className="settings-row__label">{preset.emoji} {preset.label}</span>
              <span className="settings-row__value">+</span>
            </div>
          ))}
          {GOAL_PRESETS.filter(p => !goals.some(g => g.metric === p.metric)).length === 0 && (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-state__text">Все цели уже добавлены!</div>
            </div>
          )}
        </Modal>
      )}

      <ConfirmModal
        open={showClearConfirm}
        title="Удалить все данные?"
        message="Все записи, дневник, цели, фокус-сессии и настройки будут удалены навсегда. Это действие нельзя отменить."
        onConfirm={handleClear}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
