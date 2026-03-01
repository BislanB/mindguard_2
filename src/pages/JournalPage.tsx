import { useState } from 'react';
import { useAppStore } from '../store/index.js';
import { v4 as uuid } from 'uuid';
import type { JournalEntry } from '../types/index.js';
import { MOOD_EMOJIS } from '../types/index.js';
import { ConfirmModal } from '../components/common/Modal.js';

export function JournalPage() {
    const journal = useAppStore((s) => s.journal);
    const saveJournalEntry = useAppStore((s) => s.saveJournalEntry);
    const deleteJournalEntry = useAppStore((s) => s.deleteJournalEntry);

    const [writing, setWriting] = useState(false);
    const [content, setContent] = useState('');
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const sorted = [...journal].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const handleSave = async () => {
        if (!content.trim()) return;
        const now = new Date().toISOString();
        const entry: JournalEntry = {
            id: editingId ?? uuid(),
            date: new Date().toISOString().slice(0, 10),
            content: content.trim(),
            mood: selectedMood,
            createdAt: editingId ? (journal.find(j => j.id === editingId)?.createdAt ?? now) : now,
            updatedAt: now,
        };
        await saveJournalEntry(entry);
        setWriting(false);
        setContent('');
        setSelectedMood(null);
        setEditingId(null);
    };

    const handleEdit = (entry: JournalEntry) => {
        setEditingId(entry.id);
        setContent(entry.content);
        setSelectedMood(entry.mood);
        setWriting(true);
    };

    const handleDelete = () => {
        if (deleteId) {
            deleteJournalEntry(deleteId);
            setDeleteId(null);
        }
    };

    if (writing) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-header__title">{editingId ? 'Редактировать' : 'Новая запись'}</h1>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setWriting(false); setContent(''); setEditingId(null); }}>
                        Отмена
                    </button>
                </div>

                <div className="form-group">
                    <div className="form-label">Настроение</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {MOOD_EMOJIS.map((m) => (
                            <button key={m.value}
                                className={`chip${selectedMood === m.emoji ? ' chip--active' : ''}`}
                                style={{ fontSize: 22, padding: '8px 12px' }}
                                onClick={() => setSelectedMood(selectedMood === m.emoji ? null : m.emoji)}>
                                {m.emoji}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <div className="form-label">О чём думаешь?</div>
                    <textarea
                        className="textarea"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Свободные мысли, размышления, события дня..."
                        rows={8}
                        autoFocus
                        style={{ minHeight: 200 }}
                    />
                </div>

                <button className="btn btn--primary btn--lg" onClick={handleSave} disabled={!content.trim()}>
                    Сохранить
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-header__title">Дневник</h1>
                <button className="btn btn--primary btn--sm" onClick={() => setWriting(true)}>+ Запись</button>
            </div>

            {sorted.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">📖</div>
                    <div className="empty-state__text">Дневник пуст.<br />Запишите свои мысли!</div>
                    <button className="btn btn--primary" onClick={() => setWriting(true)}>Начать писать</button>
                </div>
            ) : (
                sorted.map((entry) => {
                    const date = new Date(entry.createdAt).toLocaleDateString('ru-RU', {
                        day: 'numeric', month: 'short', year: 'numeric',
                    });
                    const time = new Date(entry.createdAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit', minute: '2-digit',
                    });

                    return (
                        <div key={entry.id} className="journal-entry" onClick={() => handleEdit(entry)}>
                            <div className="journal-entry__header">
                                <div className="journal-entry__date">{date} · {time}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {entry.mood && <span className="journal-entry__mood">{entry.mood}</span>}
                                    <button className="btn btn--ghost btn--sm"
                                        style={{ color: 'var(--danger)', padding: '4px 8px' }}
                                        onClick={(e) => { e.stopPropagation(); setDeleteId(entry.id); }}>
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div className="journal-entry__content">
                                {entry.content.length > 200 ? entry.content.slice(0, 200) + '...' : entry.content}
                            </div>
                        </div>
                    );
                })
            )}

            <ConfirmModal
                open={deleteId !== null}
                title="Удалить запись?"
                message="Эта запись будет удалена навсегда."
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
}
