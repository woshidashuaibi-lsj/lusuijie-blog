'use client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import type { Character } from '@/types/character';
import styles from './index.module.css';

// ─── CharacterCard 子组件 ──────────────────────────────────────────────────

interface CardProps {
  character: Character;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  bookSlug: string;
  bookColor: string;
}

function CharacterCard({ character, isExpanded, onExpand, onCollapse, bookSlug, bookColor }: CardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    if (isExpanded) {
      onCollapse();
    } else {
      onExpand();
    }
  };

  const handleTalk = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/book/${bookSlug}/chat?character=${character.id}`);
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 扮演模式：需要选择 AI 对话角色，暂时跳到 characters 页并带上 playAs 参数
    // 这里用 URL hash 传递玩家角色，在对话页面会弹出选择 AI 角色的弹窗
    router.push(`/book/${bookSlug}/characters?playAs=${character.id}`);
  };

  return (
    <div
      className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''}`}
      style={isExpanded ? { borderColor: `${bookColor}88` } : {}}
      onClick={handleCardClick}
      role="button"
      aria-expanded={isExpanded}
    >
      {/* 卡片头部 */}
      <div className={styles.cardHeader}>
        <div
          className={styles.avatarWrap}
          style={isExpanded ? { borderColor: bookColor, background: `${bookColor}22` } : {}}
        >
          {character.avatar}
        </div>
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{character.name}</div>
          <div className={styles.cardRole} style={{ color: isExpanded ? bookColor : undefined }}>
            {character.role}
          </div>
          {/* 折叠态显示前 2 条性格特征 */}
          {!isExpanded && (
            <div className={styles.cardTraitsPreview}>
              {character.traits.slice(0, 2).map((t, i) => (
                <span key={i} className={styles.traitTag}>
                  {t.split('：')[0] || t}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className={`${styles.expandArrow} ${isExpanded ? styles.expandArrowOpen : ''}`}>
          ▾
        </span>
      </div>

      {/* 展开详情区 */}
      {isExpanded && (
        <div className={styles.cardDetail} onClick={(e) => e.stopPropagation()}>
          {/* 性格特征 */}
          <div className={styles.detailSection}>
            <div className={styles.detailLabel}>性格特征</div>
            <ul className={styles.traitsList}>
              {character.traits.map((t, i) => (
                <li key={i} className={styles.traitsListItem}>{t}</li>
              ))}
            </ul>
          </div>

          {/* 说话风格 */}
          <div className={styles.detailSection}>
            <div className={styles.detailLabel}>说话风格</div>
            <p className={styles.speechStyleText}>{character.speechStyle}</p>
          </div>

          {/* 人物关系 */}
          {character.relations && character.relations.length > 0 && (
            <div className={styles.detailSection}>
              <div className={styles.detailLabel}>人物关系</div>
              <div className={styles.relationsList}>
                {character.relations.map((r, i) => (
                  <div key={i} className={styles.relationItem}>
                    {r.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 行动按钮 */}
          <div className={styles.actionBtns} onClick={(e) => e.stopPropagation()}>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnTalk}`}
              onClick={handleTalk}
            >
              💬 与 TA 对话
            </button>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnPlay}`}
              style={{ background: bookColor }}
              onClick={handlePlay}
            >
              🎭 扮演 TA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CharacterGallery 容器组件 ─────────────────────────────────────────────

interface GalleryProps {
  bookSlug: string;
  characters: Character[];
  bookColor: string;
}

export default function CharacterGallery({ bookSlug, characters, bookColor }: GalleryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!characters || characters.length === 0) {
    return (
      <div className={styles.galleryContainer}>
        <p className={styles.emptyTip}>暂无人物数据，敬请期待</p>
      </div>
    );
  }

  return (
    <div className={styles.galleryContainer}>
      <div className={styles.grid}>
        {characters.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            isExpanded={expandedId === character.id}
            onExpand={() => setExpandedId(character.id)}
            onCollapse={() => setExpandedId(null)}
            bookSlug={bookSlug}
            bookColor={bookColor}
          />
        ))}
      </div>
    </div>
  );
}
