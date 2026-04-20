'use client';
/**
 * Step 5：写作风格设定
 * 配置叙事视角、语言风格、节奏等，AI 在生成时严格遵循
 */
import type { NovelProject, StyleConfig as StyleConfigType, NarrativeVoice, WritingStyle, Pacing } from '@/types/novel';
import styles from './step.module.css';
import styleStyles from './StyleConfig.module.css';

interface Props {
  project: NovelProject;
  onUpdate: (updater: (p: NovelProject) => NovelProject) => void;
  onNext: () => void;
  onBack: () => void;
}

interface StyleOption<T extends string> {
  value: T;
  label: string;
  desc: string;
}

const VOICE_OPTIONS: StyleOption<NarrativeVoice>[] = [
  { value: 'first', label: '第一人称', desc: '"我"视角，代入感强，适合内心独白丰富的故事' },
  { value: 'third_limited', label: '第三人称有限视角', desc: '跟随单一视角人物，最常见的网文写法' },
  { value: 'third_omniscient', label: '第三人称全知视角', desc: '上帝视角，适合史诗级大场面叙述' },
];

const STYLE_OPTIONS: StyleOption<WritingStyle>[] = [
  { value: 'concise', label: '简洁白描', desc: '干净利落，节奏快，适合爽文/动作流' },
  { value: 'elaborate', label: '华丽细腻', desc: '丰富细节，画面感强，适合仙侠/玄幻' },
  { value: 'suspense', label: '悬疑紧张', desc: '步步为营，紧绷感强，适合悬疑/惊悚' },
  { value: 'humorous', label: '幽默风趣', desc: '轻松搞笑，适合喜剧/轻小说' },
  { value: 'lyrical', label: '抒情诗意', desc: '文学性强，情感细腻，适合文艺向' },
  { value: 'gritty', label: '写实硬核', desc: '粗粝真实，不美化，适合末世/都市' },
];

const PACING_OPTIONS: StyleOption<Pacing>[] = [
  { value: 'fast', label: '快节奏', desc: '事件密集，短句多，适合爽文读者' },
  { value: 'medium', label: '中等节奏', desc: '张弛有度，情节与描写平衡' },
  { value: 'slow', label: '慢节奏', desc: '情绪充分展开，细节丰富，适合文学向' },
];

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: StyleOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <div className={styleStyles.optionGrid}>
        {options.map(opt => (
          <button
            key={opt.value}
            className={`${styleStyles.optionCard} ${value === opt.value ? styleStyles.selected : ''}`}
            onClick={() => onChange(opt.value)}
            type="button"
          >
            <div className={styleStyles.optionLabel}>{opt.label}</div>
            <div className={styleStyles.optionDesc}>{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StyleConfig({ project, onUpdate, onNext, onBack }: Props) {
  const style = project.style;

  const updateStyle = (field: keyof StyleConfigType, value: string) => {
    onUpdate(p => ({ ...p, style: { ...p.style, [field]: value } }));
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>写作风格</h1>
        <p className={styles.subtitle}>
          定义你小说的声音与节奏<br />
          AI 在生成每一章时都会严格遵循这些设定
        </p>
      </div>

      <div className={styles.card}>
        <OptionGroup
          label="叙事视角"
          options={VOICE_OPTIONS}
          value={style.voice}
          onChange={v => updateStyle('voice', v)}
        />
      </div>

      <div className={styles.card}>
        <OptionGroup
          label="写作风格"
          options={STYLE_OPTIONS}
          value={style.style}
          onChange={v => updateStyle('style', v)}
        />
      </div>

      <div className={styles.card}>
        <OptionGroup
          label="语言节奏"
          options={PACING_OPTIONS}
          value={style.pacing}
          onChange={v => updateStyle('pacing', v)}
        />
      </div>

      <div className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label}>目标读者群（可选）</label>
          <input
            className={styles.input}
            value={style.targetAudience}
            onChange={e => updateStyle('targetAudience', e.target.value)}
            placeholder="例如：18-35岁男性，喜欢硬核修仙 / 女性向情感向读者"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>其他写作风格要求（可选）</label>
          <textarea
            className={styles.textarea}
            value={style.notes}
            onChange={e => updateStyle('notes', e.target.value)}
            placeholder="例如：主角要霸气但有人情味；女主不能恋爱脑；对话要接地气，不要文绉绉…"
          />
        </div>
      </div>

      <div className={styles.hint}>
        ✦ 准备工作已完成！点击"开始创作"后，你将进入逐章写作模式，AI 会记住所有设定。
      </div>

      <div className={styles.footer}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <button className={styles.nextBtn} onClick={onNext}>
          ✦ 开始创作！
        </button>
      </div>
    </div>
  );
}
