'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import type { Character } from '@/types/character';
import styles from './index.module.css';

// API 地址
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://lusuijie.com.cn:3001';

// ─── 书中角色提示名单（已知人物，点击可快速填入）─────────────────────────────

const BOOK_HINT_CHARACTERS: Record<string, string[]> = {
  'dao-gui-yi-xian': ['白灵淼', '长明', '长仁', '赵五', '正坤', '裂唇少年', '玄阳', '王护士'],
  'wo-kanjian-de-shijie': [],
};

// ─── Supabase 操作封装 ─────────────────────────────────────────────────────────

async function getSupabaseClient() {
  if (typeof window === 'undefined') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(url, key);
  } catch {
    return null;
  }
}

async function loadUserCharacters(bookSlug: string): Promise<(Character & { isUserAdded: true })[]> {
  const sb = await getSupabaseClient();
  if (!sb) return [];
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];

  const { data, error } = await sb
    .from('user_characters')
    .select('*')
    .eq('user_id', user.id)
    .eq('book_slug', bookSlug)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.char_id as string,
    name: row.name as string,
    avatar: row.avatar as string,
    role: row.role as string,
    traits: (row.traits as string[]) || [],
    speechStyle: row.speech_style as string,
    persona: row.persona as string,
    relations: (row.relations as Character['relations']) || [],
    isUserAdded: true as const,
  }));
}

async function saveUserCharacter(
  bookSlug: string,
  character: Character
): Promise<{ ok: boolean; message?: string }> {
  const sb = await getSupabaseClient();
  if (!sb) return { ok: false, message: '无法连接数据库' };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, message: '请先登录' };

  const { error } = await sb.from('user_characters').upsert({
    user_id: user.id,
    book_slug: bookSlug,
    char_id: character.id,
    name: character.name,
    avatar: character.avatar,
    role: character.role,
    traits: character.traits,
    speech_style: character.speechStyle,
    persona: character.persona,
    relations: character.relations,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,book_slug,char_id' });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

async function deleteUserCharacter(bookSlug: string, charId: string): Promise<boolean> {
  const sb = await getSupabaseClient();
  if (!sb) return false;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { error } = await sb
    .from('user_characters')
    .delete()
    .eq('user_id', user.id)
    .eq('book_slug', bookSlug)
    .eq('char_id', charId);
  return !error;
}

// ─── CharacterCard 子组件 ──────────────────────────────────────────────────

interface CardProps {
  character: Character & { isUserAdded?: boolean };
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onDelete?: () => void;
  bookSlug: string;
  bookColor: string;
}

function CharacterCard({ character, isExpanded, onExpand, onCollapse, onDelete, bookSlug, bookColor }: CardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    if (isExpanded) onCollapse();
    else onExpand();
  };

  const handleTalk = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/book/${bookSlug}/chat?character=${character.id}`);
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/book/${bookSlug}/characters?playAs=${character.id}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`确定删除「${character.name}」的图鉴？`)) {
      onDelete?.();
    }
  };

  return (
    <div
      className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''} ${character.isUserAdded ? styles.cardUser : ''}`}
      style={isExpanded ? { borderColor: `${bookColor}88` } : {}}
      onClick={handleCardClick}
      role="button"
      aria-expanded={isExpanded}
    >
      {/* 用户添加标记 */}
      {character.isUserAdded && (
        <div className={styles.userTag} style={{ background: `${bookColor}22`, color: bookColor }}>
          ✦ 我的图鉴
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
          {character.speechStyle && (
            <div className={styles.detailSection}>
              <div className={styles.detailLabel}>说话风格</div>
              <p className={styles.speechStyleText}>{character.speechStyle}</p>
            </div>
          )}

          {/* 人物关系 */}
          {character.relations && character.relations.length > 0 && (
            <div className={styles.detailSection}>
              <div className={styles.detailLabel}>人物关系</div>
              <div className={styles.relationsList}>
                {character.relations.map((r, i) => (
                  <div key={i} className={styles.relationItem}>{r.description}</div>
                ))}
              </div>
            </div>
          )}

          {/* 行动按钮 */}
          <div className={styles.actionBtns} onClick={(e) => e.stopPropagation()}>
            <button className={`${styles.actionBtn} ${styles.actionBtnTalk}`} onClick={handleTalk}>
              💬 与 TA 对话
            </button>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnPlay}`}
              style={{ background: bookColor }}
              onClick={handlePlay}
            >
              🎭 扮演 TA
            </button>
            {character.isUserAdded && onDelete && (
              <button className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={handleDelete}>
                🗑 删除
              </button>
            )}
          </div>
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

// ─── 添加人物弹窗 ────────────────────────────────────────────────────────────

interface AddCharacterModalProps {
  bookSlug: string;
  bookColor: string;
  existingIds: string[];
  onClose: () => void;
  onSaved: (character: Character & { isUserAdded: true }) => void;
}

function AddCharacterModal({ bookSlug, bookColor, existingIds, onClose, onSaved }: AddCharacterModalProps) {
  const [inputName, setInputName] = useState('');
  const [step, setStep] = useState<'input' | 'generating' | 'preview'>('input');
  const [generated, setGenerated] = useState<Character | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hints = BOOK_HINT_CHARACTERS[bookSlug] || [];
  // 过滤掉已经添加过的
  const availableHints = hints.filter(name => {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return !existingIds.includes(slug);
  });

  const handleGenerate = useCallback(async () => {
    const name = inputName.trim();
    if (!name) return;
    setStep('generating');
    setError(null);

    try {
      const resp = await fetch(`${API_BASE}/api/characters/generate-by-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookSlug, characterName: name }),
      });

      const data = await resp.json() as { character?: Character; message?: string };

      if (!resp.ok || !data.character) {
        throw new Error(data.message || '生成失败，请重试');
      }

      setGenerated(data.character);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
      setStep('input');
    }
  }, [inputName, bookSlug]);

  const handleSave = useCallback(async () => {
    if (!generated) return;
    setSaving(true);
    setError(null);

    const result = await saveUserCharacter(bookSlug, generated);
    if (!result.ok) {
      setError(result.message || '保存失败');
      setSaving(false);
      return;
    }

    onSaved({ ...generated, isUserAdded: true as const });
    onClose();
  }, [generated, bookSlug, onSaved, onClose]);

  const handleRegenerate = () => {
    setGenerated(null);
    setStep('input');
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ borderColor: `${bookColor}44` }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle} style={{ color: bookColor }}>
            ✦ 添加人物图鉴
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* 步骤：输入 */}
        {(step === 'input' || step === 'generating') && (
          <>
            <p className={styles.modalDesc}>
              输入书中任意人物的姓名，AI 将从书籍内容中分析并生成专属图鉴。
            </p>

            {/* 快捷提示人物 */}
            {availableHints.length > 0 && (
              <div className={styles.hintSection}>
                <div className={styles.hintLabel}>书中人物参考</div>
                <div className={styles.hintTags}>
                  {availableHints.map(name => (
                    <button
                      key={name}
                      className={styles.hintTag}
                      style={{ borderColor: `${bookColor}44`, color: bookColor }}
                      onClick={() => setInputName(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 输入框 */}
            <div className={styles.inputRow}>
              <input
                className={styles.nameInput}
                style={{ borderColor: `${bookColor}44` }}
                type="text"
                placeholder="输入人物姓名…"
                value={inputName}
                onChange={e => setInputName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !step.startsWith('gen') && handleGenerate()}
                maxLength={30}
                autoFocus
                disabled={step === 'generating'}
              />
              <button
                className={styles.generateBtn}
                style={{ background: bookColor }}
                onClick={handleGenerate}
                disabled={!inputName.trim() || step === 'generating'}
              >
                {step === 'generating' ? (
                  <span className={styles.btnSpinner} />
                ) : 'AI 生成'}
              </button>
            </div>

            {step === 'generating' && (
              <p className={styles.generatingHint}>✦ AI 正在从书中分析「{inputName}」的人物图鉴，请稍候…</p>
            )}

            {error && <p className={styles.modalError}>⚠ {error}</p>}
          </>
        )}

        {/* 步骤：预览生成结果 */}
        {step === 'preview' && generated && (
          <>
            <div className={styles.previewCard} style={{ borderColor: `${bookColor}33` }}>
              <div className={styles.previewHeader}>
                <span className={styles.previewAvatar}>{generated.avatar}</span>
                <div>
                  <div className={styles.previewName}>{generated.name}</div>
                  <div className={styles.previewRole} style={{ color: bookColor }}>{generated.role}</div>
                </div>
              </div>

              <div className={styles.previewTraits}>
                {generated.traits.map((t, i) => (
                  <div key={i} className={styles.previewTrait}>· {t}</div>
                ))}
              </div>

              {generated.speechStyle && (
                <div className={styles.previewSpeech}>
                  <span className={styles.previewSpeechLabel}>说话风格：</span>
                  {generated.speechStyle}
                </div>
              )}
            </div>

            {error && <p className={styles.modalError}>⚠ {error}</p>}

            <div className={styles.previewActions}>
              <button className={styles.regenBtn} onClick={handleRegenerate} disabled={saving}>
                重新生成
              </button>
              <button
                className={styles.saveBtn}
                style={{ background: bookColor }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '保存中…' : '✓ 保存到图鉴'}
              </button>
            </div>
          </>
        )}
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

type UserCharacter = Character & { isUserAdded: true };

export default function CharacterGallery({ bookSlug, characters, bookColor }: GalleryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userCharacters, setUserCharacters] = useState<UserCharacter[]>([]);
  const [loadingUserChars, setLoadingUserChars] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // 从 Supabase 加载用户已保存的人物
  useEffect(() => {
    let cancelled = false;
    setLoadingUserChars(true);
    loadUserCharacters(bookSlug).then(data => {
      if (!cancelled) {
        setUserCharacters(data);
        setLoadingUserChars(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingUserChars(false);
    });
    return () => { cancelled = true; };
  }, [bookSlug]);

  const handleSaved = useCallback((character: UserCharacter) => {
    setUserCharacters(prev => {
      // 去重（如果已存在同 id 则替换）
      const filtered = prev.filter(c => c.id !== character.id);
      return [...filtered, character];
    });
  }, []);

  const handleDelete = useCallback(async (charId: string) => {
    const ok = await deleteUserCharacter(bookSlug, charId);
    if (ok) {
      setUserCharacters(prev => prev.filter(c => c.id !== charId));
      if (expandedId === charId) setExpandedId(null);
    }
  }, [bookSlug, expandedId]);

  // 合并内置人物 + 用户人物（用户人物去重：已在内置里的不重复展示）
  const builtinIds = new Set(characters.map(c => c.id));
  const uniqueUserChars = userCharacters.filter(c => !builtinIds.has(c.id));
  const allCharacters = [...characters, ...uniqueUserChars];

  // 已存在的所有 id（用于弹窗提示过滤）
  const existingIds = allCharacters.map(c => c.id);

  if (!characters || characters.length === 0) {
    return (
      <div className={styles.galleryContainer}>
        <p className={styles.emptyTip}>暂无人物数据，敬请期待</p>
      </div>
    );
  }

  return (
    <div className={styles.galleryContainer}>
      {/* 人物卡片网格 */}
      <div className={styles.grid}>
        {allCharacters.map((character) => {
          const isUser = (character as UserCharacter).isUserAdded;
          return (
            <CharacterCard
              key={character.id}
              character={character}
              isExpanded={expandedId === character.id}
              onExpand={() => setExpandedId(character.id)}
              onCollapse={() => setExpandedId(null)}
              onDelete={isUser ? () => handleDelete(character.id) : undefined}
              bookSlug={bookSlug}
              bookColor={bookColor}
            />
          );
        })}

        {/* Loading 骨架屏（加载用户人物时） */}
        {loadingUserChars && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}
      </div>

      {/* 添加人物按钮 */}
      {!loadingUserChars && (
        <div className={styles.addBtnWrap}>
          <button
            className={styles.addBtn}
            style={{ borderColor: `${bookColor}55`, color: bookColor }}
            onClick={() => setShowAddModal(true)}
          >
            <span className={styles.addBtnIcon}>＋</span>
            添加人物图鉴
            <span className={styles.addBtnHint} style={{ background: `${bookColor}18` }}>
              AI 生成
            </span>
          </button>
        </div>
      )}

      {/* 添加人物弹窗 */}
      {showAddModal && (
        <AddCharacterModal
          bookSlug={bookSlug}
          bookColor={bookColor}
          existingIds={existingIds}
          onClose={() => setShowAddModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
