'use client';
import type { WizardStep } from '@/types/novel';
import styles from './WizardNav.module.css';

interface WizardNavProps {
  currentStep: WizardStep;
  onNavigate: (step: WizardStep) => void;
  onBackToList?: () => void;
}

const STEPS: Array<{ key: WizardStep; label: string; icon: string }> = [
  { key: 'outline', label: '故事大纲', icon: '📖' },
  { key: 'world', label: '世界构建', icon: '🌐' },
  { key: 'characters', label: '人物塑造', icon: '👤' },
  { key: 'plot', label: '情节伏笔', icon: '🗺️' },
  { key: 'style', label: '写作风格', icon: '✍️' },
];

const STEP_ORDER: Record<WizardStep, number> = {
  outline: 0,
  world: 1,
  characters: 2,
  plot: 3,
  style: 4,
  writing: 5,
};

export default function WizardNav({ currentStep, onNavigate, onBackToList }: WizardNavProps) {
  const currentIdx = STEP_ORDER[currentStep] ?? 0;

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        {onBackToList && (
          <button className={styles.backToList} onClick={onBackToList} title="返回项目列表">
            ←
          </button>
        )}
        <span className={styles.brandIcon}>✦</span>
        <span className={styles.brandText}>创造世界</span>
      </div>

      <div className={styles.steps}>
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isAccessible = idx <= currentIdx;

          return (
            <button
              key={step.key}
              className={`${styles.step} ${isCompleted ? styles.completed : ''} ${isCurrent ? styles.current : ''}`}
              onClick={() => isAccessible && onNavigate(step.key)}
              disabled={!isAccessible}
              title={step.label}
            >
              <div className={styles.stepIcon}>
                {isCompleted ? '✓' : step.icon}
              </div>
              <span className={styles.stepLabel}>{step.label}</span>
              {idx < STEPS.length - 1 && (
                <div className={`${styles.connector} ${isCompleted ? styles.connectorDone : ''}`} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
