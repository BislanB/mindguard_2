import { useAppStore } from '../../store/index.js';

export function StreakCelebration() {
    const milestone = useAppStore((s) => s.showCelebration);
    const dismiss = useAppStore((s) => s.dismissCelebration);

    if (!milestone) return null;

    return (
        <div className="celebration-overlay" onClick={dismiss}>
            <div className="celebration" onClick={(e) => e.stopPropagation()}>
                <div className="celebration__emoji">{milestone.emoji}</div>
                <div className="celebration__title">{milestone.title}</div>
                <div className="celebration__message">{milestone.message}</div>
                <button className="btn btn--primary" onClick={dismiss} style={{ marginTop: 16 }}>
                    Продолжить 🚀
                </button>
            </div>
        </div>
    );
}
