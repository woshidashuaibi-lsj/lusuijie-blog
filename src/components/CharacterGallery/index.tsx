'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import type { Character } from '@/types/character';
import styles from './index.module.css';

// API 地址
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://lusuijie.com.cn:3001';

// ─── CharacterCard 子组件 ──────────────────────────────────────────────────

interface CardProps {
  character: Character & { isAiExtracted?: boolean };
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
    router.push(`/book/${bookSlug}/characters?playAs=${character.id}`);
  };

  return (
    <div
      className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''} ${character.isAiExtracted ? styles.cardAi : ''}`}
      style={isExpanded ? { borderColor: `${bookColor}88` } : {}}
      onClick={handleCardClick}
      role="button"
      aria-expanded={isExpanded}
    >
      {/* AI 提取标记 */}
      {character.isAiExtracted && (
        <div className={styles.aiTag} style={{ background: `${bookColor}22`, color: bookColor }}>
          ✦ AI 推断
        </div>
      )}

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

          {/* 行动按钮（AI 提取人物暂不支持对话/扮演） */}
          {!character.isAiExtracted && (
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
          )}
        </div>
      )}
    </div>
  );
}

// ─── 骨架屏卡片 ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonAvatar} />
        <div className={styles.skeletonInfo}>
          <div className={styles.skeletonLine} style={{ width: '40%' }} />
          <div className={styles.skeletonLine} style={{ width: '60%' }} />
          <div className={styles.skeletonLine} style={{ width: '50%' }} />
        </div>
      </div>
    </div>
  );
}

// ─── CharacterGallery 容器组件 ─────────────────────────────────────────────

interface GalleryProps {
  bookSlug: string;
  characters: Character[];
  bookColor: string;
}

// 默认展示数量
const DEFAULT_SHOW_COUNT = 3;

type AiCharacter = Character & { isAiExtracted: true };

export default function CharacterGallery({ bookSlug, characters, bookColor }: GalleryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // AI 提取的人物列表
  const [aiCharacters, setAiCharacters] = useState<AiCharacter[]>([]);
  // 请求状态
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  // 是否已经触发过提取
  const [hasExtracted, setHasExtracted] = useState(false);

  const handleExtract = useCallback(async () => {
    if (extracting) return;
    setExtracting(true);
    setExtractError(null);

    try {
      const knownIds = characters.map((c) => c.id);
      const resp = await fetch(`${API_BASE}/api/characters/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookSlug, knownCharacterIds: knownIds }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: '请求失败' }));
        throw new Error((err as { message?: string }).message || '请求失败');
      }

      const data = await resp.json() as { characters: AiCharacter[] };
      setAiCharacters((data.characters || []).map((c) => ({ ...c, isAiExtracted: true })));
      setHasExtracted(true);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : '获取失败，请重试');
    } finally {
      setExtracting(false);
    }
  }, [bookSlug, characters, extracting]);

  if (!characters || characters.length === 0) {
    return (
      <div className={styles.galleryContainer}>
        <p className={styles.emptyTip}>暂无人物数据，敬请期待</p>
      </div>
    );
  }

  // 合并已有人物 + AI 提取人物
  const allCharacters = [...characters, ...aiCharacters];
  const showLoadMore = !hasExtracted;

  return (
    <div className={styles.galleryContainer}>
      <div className={styles.grid}>
        {allCharacters.map((character) => (
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

        {/* Loading 骨架屏 */}
        {extracting && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}
      </div>

      {/* 错误提示 */}
      {extractError && (
        <div className={styles.errorTip}>
          <span>⚠ {extractError}</span>
          <button
            className={styles.retryBtn}
            style={{ color: bookColor, borderColor: `${bookColor}55` }}
            onClick={handleExtract}
          >
            重试
          </button>
        </div>
      )}

      {/* 获取更多 / 已全部展示 */}
      {showLoadMore && !extracting && !extractError && (
        <div className={styles.loadMoreWrap}>
          <button
            className={styles.loadMoreBtn}
            style={{ borderColor: `${bookColor}55`, color: bookColor }}
            onClick={handleExtract}
          >
            <span className={styles.loadMoreIcon}>✦</span>
            获取更多人物图鉴
            <span className={styles.loadMoreHint} style={{ background: `${bookColor}18` }}>
              AI 推断
            </span>
          </button>
        </div>
      )}

      {/* 提取完毕提示 */}
      {hasExtracted && aiCharacters.length === 0 && (
        <div className={styles.extractDone}>
          ✓ 已探索全部人物
        </div>
      )}

      {hasExtracted && aiCharacters.length > 0 && (
        <div className={styles.extractDone} style={{ color: bookColor }}>
          ✦ AI 共推断出 {aiCharacters.length} 位人物
        </div>
      )}
    </div>
  );
}
