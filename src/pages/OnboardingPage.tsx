import { useState } from 'react';
import { useAppStore } from '../store/index.js';

const features = [
    { icon: '📊', text: 'Ежедневный трекинг сна, энергии, стресса и настроения' },
    { icon: '🎯', text: 'Фокус-таймер и дыхательные упражнения' },
    { icon: '🛡️', text: 'Блокировка отвлекающих сайтов и коротких видео' },
    { icon: '📖', text: 'Личный дневник для рефлексии' },
    { icon: '📈', text: 'Аналитика и инсайты по вашим данным' },
    { icon: '🏆', text: 'Цели и серии для мотивации' },
];

export function OnboardingPage() {
    const updateSettings = useAppStore((s) => s.updateSettings);
    const [step, setStep] = useState(0);

    if (step === 0) {
        return (
            <div className="onboarding">
                <div className="onboarding__icon">🛡️</div>
                <h1 className="onboarding__title">MindGuard</h1>
                <p className="onboarding__text">
                    Твой личный помощник для осознанной жизни, продуктивности и цифрового благополучия
                </p>
                <button className="btn btn--primary btn--lg" style={{ maxWidth: 320 }}
                    onClick={() => setStep(1)}>
                    Начать
                </button>
            </div>
        );
    }

    if (step === 1) {
        return (
            <div className="onboarding">
                <div className="onboarding__icon">✨</div>
                <h1 className="onboarding__title" style={{ fontSize: 24 }}>Возможности</h1>
                <div className="onboarding__features">
                    {features.map((f, i) => (
                        <div key={i} className="onboarding__feature">
                            <span className="onboarding__feature-icon">{f.icon}</span>
                            <span>{f.text}</span>
                        </div>
                    ))}
                </div>
                <button className="btn btn--primary btn--lg" style={{ maxWidth: 320 }}
                    onClick={() => setStep(2)}>
                    Далее
                </button>
            </div>
        );
    }

    return (
        <div className="onboarding">
            <div className="onboarding__icon">🚀</div>
            <h1 className="onboarding__title" style={{ fontSize: 24 }}>Готово!</h1>
            <p className="onboarding__text">
                Начните с записи своего настроения на главном экране.
                Заполняйте трекинг каждый день — и вскоре увидите паттерны и инсайты о своей жизни.
            </p>
            <button className="btn btn--primary btn--lg" style={{ maxWidth: 320 }}
                onClick={() => updateSettings({ onboardingCompleted: true })}>
                Поехали!
            </button>
        </div>
    );
}
