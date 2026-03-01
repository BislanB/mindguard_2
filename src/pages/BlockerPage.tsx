import { useState } from 'react';
import { useAppStore, formatTime } from '../store/index.js';
import { Modal } from '../components/common/Modal.js';
import { v4 as uuid } from 'uuid';
import type { BlockRule, BlockTarget, BlockMode } from '../types/index.js';

const MODE_LABELS: Record<BlockMode, { label: string; desc: string; icon: string }> = {
    full: { label: 'Полная', desc: 'Полностью заблокировано', icon: '🚫' },
    cooldown: { label: 'Пауза', desc: 'Подожди перед входом', icon: '⏳' },
    'time-limit': { label: 'Лимит', desc: 'Ограничение по времени', icon: '⏱' },
};

export function BlockerPage() {
    const settings = useAppStore((s) => s.settings);
    const blockRules = useAppStore((s) => s.blockRules);
    const blockAttempts = useAppStore((s) => s.blockAttempts);
    const updateSettings = useAppStore((s) => s.updateSettings);
    const saveBlockRule = useAppStore((s) => s.saveBlockRule);
    const deleteBlockRule = useAppStore((s) => s.deleteBlockRule);
    const checkUrl = useAppStore((s) => s.checkUrl);
    const saveBlockAttempt = useAppStore((s) => s.saveBlockAttempt);

    const [editingRule, setEditingRule] = useState<BlockRule | null>(null);
    const [testUrl, setTestUrl] = useState('');
    const [testResult, setTestResult] = useState<{ blocked: boolean; rule: BlockRule | null; mode: string } | null>(null);
    const [tab, setTab] = useState<'rules' | 'test' | 'log'>('rules');
    const [cooldownActive, setCooldownActive] = useState<{ rule: BlockRule; seconds: number } | null>(null);

    // Test URL
    const handleTest = () => {
        if (!testUrl.trim()) return;
        const result = checkUrl(testUrl);
        setTestResult(result);

        if (result.blocked && result.rule) {
            saveBlockAttempt({
                id: uuid(), ruleId: result.rule.id, ruleName: result.rule.name,
                url: testUrl, timestamp: new Date().toISOString(),
                action: result.mode === 'full' ? 'blocked' : 'cooldown-started',
            });

            if (result.mode === 'cooldown') {
                setCooldownActive({ rule: result.rule, seconds: result.rule.cooldownMinutes * 60 });
                const interval = setInterval(() => {
                    setCooldownActive((prev) => {
                        if (!prev || prev.seconds <= 1) {
                            clearInterval(interval);
                            return null;
                        }
                        return { ...prev, seconds: prev.seconds - 1 };
                    });
                }, 1000);
            }
        }
    };

    const recentAttempts = [...blockAttempts]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 30);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-header__title">Защита</h1>
                <div className="toggle" onClick={() => updateSettings({ blockerEnabled: !settings.blockerEnabled })}>
                    <div className={`toggle__track${settings.blockerEnabled ? '' : ''}`}
                        style={settings.blockerEnabled ? { background: 'var(--success)' } : {}}>
                        <div className="toggle__thumb" style={settings.blockerEnabled ? { transform: 'translateX(20px)' } : {}} />
                    </div>
                </div>
            </div>

            {!settings.blockerEnabled && (
                <div className="card mb-20" style={{ textAlign: 'center', color: 'var(--warning)' }}>
                    ⚠️ Защита отключена. Включите для блокировки.
                </div>
            )}

            <div className="tabs">
                <button className={`tabs__item${tab === 'rules' ? ' tabs__item--active' : ''}`}
                    onClick={() => setTab('rules')}>Правила</button>
                <button className={`tabs__item${tab === 'test' ? ' tabs__item--active' : ''}`}
                    onClick={() => setTab('test')}>Проверка</button>
                <button className={`tabs__item${tab === 'log' ? ' tabs__item--active' : ''}`}
                    onClick={() => setTab('log')}>Журнал</button>
            </div>

            {/* ── Rules Tab ── */}
            {tab === 'rules' && (
                <div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                        Настройте категории блокировки. Блокировка работает во встроенном браузере приложения.
                        Для системной блокировки используйте DNS-фильтрацию или расширение для браузера.
                    </p>

                    {blockRules.map((rule) => (
                        <div key={rule.id} className="block-category">
                            <div className="block-category__header">
                                <div className="block-category__icon">{rule.icon}</div>
                                <div className="block-category__info">
                                    <div className="block-category__name">{rule.name}</div>
                                    <div className="block-category__detail">
                                        {rule.targets.length} целей · {MODE_LABELS[rule.mode].label}
                                        {rule.mode === 'cooldown' && ` · ${rule.cooldownMinutes} мин`}
                                        {rule.mode === 'time-limit' && ` · ${rule.dailyLimitMinutes} мин/день`}
                                    </div>
                                </div>
                                <div className="toggle" onClick={() => saveBlockRule({ ...rule, enabled: !rule.enabled })}>
                                    <div className="toggle__track" style={rule.enabled ? { background: 'var(--success)' } : {}}>
                                        <div className="toggle__thumb" style={rule.enabled ? { transform: 'translateX(20px)' } : {}} />
                                    </div>
                                </div>
                            </div>

                            {rule.enabled && (
                                <div className="block-category__body">
                                    {/* Mode selector */}
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                                        Режим блокировки
                                    </div>
                                    <div className="block-mode-selector">
                                        {(['full', 'cooldown', 'time-limit'] as BlockMode[]).map((mode) => (
                                            <button key={mode}
                                                className={`block-mode-btn${rule.mode === mode ? ' block-mode-btn--active' : ''}`}
                                                onClick={() => saveBlockRule({ ...rule, mode })}>
                                                {MODE_LABELS[mode].icon} {MODE_LABELS[mode].label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Cooldown setting */}
                                    {rule.mode === 'cooldown' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Время на раздумья:</span>
                                            <input className="input input--sm" type="number" min={1} max={60}
                                                value={rule.cooldownMinutes} style={{ width: 60, textAlign: 'center' }}
                                                onChange={(e) => saveBlockRule({ ...rule, cooldownMinutes: Number(e.target.value) })} />
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>мин</span>
                                        </div>
                                    )}

                                    {/* Time limit setting */}
                                    {rule.mode === 'time-limit' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Лимит:</span>
                                            <input className="input input--sm" type="number" min={5} max={240}
                                                value={rule.dailyLimitMinutes} style={{ width: 60, textAlign: 'center' }}
                                                onChange={(e) => saveBlockRule({ ...rule, dailyLimitMinutes: Number(e.target.value) })} />
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>мин/день</span>
                                        </div>
                                    )}

                                    {/* Targets */}
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                                            Цели ({rule.targets.length})
                                        </div>
                                        <div className="chips">
                                            {rule.targets.slice(0, 6).map((t, i) => (
                                                <span key={i} className="chip" style={{ fontSize: 11, padding: '4px 10px' }}>
                                                    {t.type === 'path' ? '/' : ''}{t.value}
                                                </span>
                                            ))}
                                            {rule.targets.length > 6 && (
                                                <span className="chip" style={{ fontSize: 11, padding: '4px 10px' }}>
                                                    +{rule.targets.length - 6}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button className="btn btn--ghost btn--sm mt-8"
                                        onClick={() => setEditingRule({ ...rule })}>
                                        ✏️ Редактировать
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}

                    <button className="btn btn--secondary btn--lg mt-16" onClick={() => {
                        setEditingRule({
                            id: uuid(), name: '', icon: '⚙️', category: 'custom',
                            targets: [], mode: 'cooldown', cooldownMinutes: 10,
                            dailyLimitMinutes: 30, schedule: null, enabled: true,
                        });
                    }}>
                        + Добавить правило
                    </button>
                </div>
            )}

            {/* ── Test Tab ── */}
            {tab === 'test' && (
                <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <input className="input" type="url" placeholder="Введите URL для проверки..."
                            value={testUrl} onChange={(e) => setTestUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTest()} style={{ flex: 1 }} />
                        <button className="btn btn--primary btn--sm" onClick={handleTest}>Проверить</button>
                    </div>

                    {cooldownActive && (
                        <div className="block-screen" style={{ minHeight: 'auto', padding: 32 }}>
                            <div className="block-screen__icon">⏳</div>
                            <div className="block-screen__title">Подождите</div>
                            <div className="block-screen__message">
                                Правило «{cooldownActive.rule.name}» требует паузу перед доступом.
                            </div>
                            <div className="block-screen__countdown">{formatTime(cooldownActive.seconds)}</div>
                            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 300 }}>
                                <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => setCooldownActive(null)}>
                                    ← Вернуться
                                </button>
                            </div>
                        </div>
                    )}

                    {testResult && !cooldownActive && (
                        <div className="card" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 48, marginBottom: 8 }}>
                                {testResult.blocked ? '🛑' : '✅'}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                                {testResult.blocked ? 'Заблокировано' : 'Разрешено'}
                            </div>
                            {testResult.rule && (
                                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                    Правило: {testResult.rule.name} · Режим: {MODE_LABELS[testResult.mode as BlockMode]?.label}
                                </div>
                            )}
                        </div>
                    )}

                    {!testResult && !cooldownActive && (
                        <div className="empty-state">
                            <div className="empty-state__icon">🔍</div>
                            <div className="empty-state__text">Введите URL чтобы проверить,<br />будет ли он заблокирован</div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Log Tab ── */}
            {tab === 'log' && (
                <div>
                    {recentAttempts.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state__icon">📋</div>
                            <div className="empty-state__text">Журнал пуст</div>
                        </div>
                    ) : (
                        recentAttempts.map((a) => {
                            const icon = a.action === 'blocked' ? '🚫' :
                                a.action === 'went-back' ? '✅' :
                                    a.action === 'cooldown-started' ? '⏳' : '🔓';
                            const label = a.action === 'blocked' ? 'Заблокировано' :
                                a.action === 'went-back' ? 'Вернулся' :
                                    a.action === 'cooldown-started' ? 'Cooldown' : 'Разрешено';
                            return (
                                <div key={a.id} className="history-item">
                                    <div className="history-item__mood">{icon}</div>
                                    <div className="history-item__info">
                                        <div className="history-item__date">{a.ruleName} — {label}</div>
                                        <div className="history-item__metrics">
                                            <span>{a.url.slice(0, 40)}</span>
                                            <span>· {new Date(a.timestamp).toLocaleString('ru-RU')}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── Edit Rule Modal ── */}
            {editingRule && (
                <Modal open onClose={() => setEditingRule(null)} title={editingRule.name ? 'Редактировать' : 'Новое правило'}>
                    <div className="form-group">
                        <label className="form-label">Название</label>
                        <input className="input" value={editingRule.name}
                            onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Иконка</label>
                        <input className="input" value={editingRule.icon} style={{ width: 60, fontSize: 24, textAlign: 'center' }}
                            onChange={(e) => setEditingRule({ ...editingRule, icon: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Домены и пути (по одному на строку)</label>
                        <textarea className="textarea" rows={5}
                            value={editingRule.targets.map(t => (t.type === 'keyword' ? `kw:${t.value}` : t.value)).join('\n')}
                            onChange={(e) => {
                                const lines = e.target.value.split('\n').map(l => l.trim()).filter(Boolean);
                                const targets: BlockTarget[] = lines.map(l => {
                                    if (l.startsWith('kw:')) return { type: 'keyword', value: l.slice(3) };
                                    if (l.includes('/')) return { type: 'path', value: l };
                                    return { type: 'domain', value: l };
                                });
                                setEditingRule({ ...editingRule, targets });
                            }}
                            placeholder={'instagram.com\nyoutube.com/shorts\nkw:porn'}
                        />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            Домены: site.com · Пути: site.com/shorts · Ключевые слова: kw:слово
                        </div>
                    </div>

                    <div className="modal__actions">
                        {editingRule.category === 'custom' && editingRule.name && (
                            <button className="btn btn--danger" onClick={() => { deleteBlockRule(editingRule.id); setEditingRule(null); }}>
                                Удалить
                            </button>
                        )}
                        <button className="btn btn--secondary" onClick={() => setEditingRule(null)}>Отмена</button>
                        <button className="btn btn--primary" disabled={!editingRule.name}
                            onClick={() => { saveBlockRule(editingRule); setEditingRule(null); }}>
                            Сохранить
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
