'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { Character } from '@/types/character';
import styles from './index.module.css';

interface Source {
  chapterTitle: string;
  excerpt: string;
  score: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** AI 思考过程，与正式回答分开存储 */
  thinking?: string;
  sources?: Source[];
}

interface BookChatProps {
  bookSlug: string;
  bookTitle: string;
  /** 书中人物列表（由 getStaticProps 在构建期注入，不依赖 API Routes） */
  characters?: Character[];
  /** 读者模式：目标角色 ID（不传则用默认主角） */
  initialCharacterId?: string;
  /** 玩家扮演模式：玩家马甲角色 ID */
  playerCharacterId?: string;
  /** 玩家扮演模式：AI 扮演角色 ID */
  aiCharacterId?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

// 每本书的角色扮演配置（向下兼容：未指定 characterId 时使用此配置）
const BOOK_ROLEPLAY: Record<string, {
  enabled: boolean;
  characterName: string;
  avatar: string;
  greeting: string;
  placeholder: string;
}> = {
  'dao-gui-yi-xian': {
    enabled: true,
    characterName: '李火旺',
    avatar: '火',
    greeting: '就知道你们这些局外人会有一堆奇怪问题问我。说吧，什么事？我的幻觉里什么都见过。',
    placeholder: '问杯山下的李火旺任何问题…',
  },
};

/** 思考块：可折叠展示 */
function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (!thinking) return null;
  return (
    <div className={styles.thinkingBlock}>
      <button
        className={styles.thinkingToggle}
        onClick={() => setExpanded(v => !v)}
        type="button"
      >
        <span className={styles.thinkingIcon}>💭</span>
        <span>{isStreaming ? '思考中…' : '查看思考过程'}</span>
        <span className={`${styles.thinkingArrow} ${expanded ? styles.thinkingArrowOpen : ''}`}>▾</span>
      </button>
      {expanded && (
        <div className={styles.thinkingContent}>
          {thinking}
        </div>
      )}
    </div>
  );
}

// ─── 人物切换选择器 ─────────────────────────────────────────────────────────

interface CharacterPickerProps {
  characters: Character[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  bookColor?: string;
}

function CharacterPicker({ characters, currentId, onSelect, onClose, bookColor = '#6366f1' }: CharacterPickerProps) {
  return (
    <div className={styles.pickerOverlay} onClick={onClose}>
      <div
        className={styles.pickerModal}
        style={{ borderColor: `${bookColor}55` }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.pickerHeader}>
          <span className={styles.pickerTitle}>切换对话人物</span>
          <button className={styles.pickerClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.pickerList}>
          {characters.map(c => (
            <button
              key={c.id}
              className={`${styles.pickerItem} ${c.id === currentId ? styles.pickerItemActive : ''}`}
              style={c.id === currentId ? { borderColor: bookColor } : {}}
              onClick={() => { onSelect(c.id); onClose(); }}
            >
              <span className={styles.pickerItemAvatar}>{c.avatar}</span>
              <div className={styles.pickerItemInfo}>
                <div className={styles.pickerItemName}>{c.name}</div>
                <div className={styles.pickerItemRole}>{c.role}</div>
              </div>
              {c.id === currentId && (
                <span style={{ color: bookColor, fontWeight: 700, fontSize: '0.8rem' }}>当前</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 主 BookChat 组件 ───────────────────────────────────────────────────────

export default function BookChat({
  bookSlug,
  bookTitle,
  characters: propCharacters = [],
  initialCharacterId,
  playerCharacterId,
  aiCharacterId,
}: BookChatProps) {
  // 判断当前模式
  const isPlayerMode = !!(playerCharacterId && aiCharacterId);

  // 读者模式：当前与哪个 AI 角色对话（可切换）
  const [activeCharacterId, setActiveCharacterId] = useState<string | undefined>(
    isPlayerMode ? aiCharacterId : initialCharacterId
  );

  // 人物列表直接来自 props（由 getStaticProps 在构建期注入），无需运行时 fetch
  const characters = propCharacters;

  console.log('[BookChat] props:', { initialCharacterId, playerCharacterId, aiCharacterId, isPlayerMode, activeCharacterId, charactersCount: characters.length, characterIds: characters.map(c => c.id) });
  const [showPicker, setShowPicker] = useState(false);

  // 根据 activeCharacterId 找到对应 character 数据
  const aiCharacter = characters.find(c => c.id === (isPlayerMode ? aiCharacterId : activeCharacterId));
  const playerCharacter = isPlayerMode ? characters.find(c => c.id === playerCharacterId) : null;

  // 兜底：使用旧版配置（未指定 characterId 时）
  const legacyRoleplay = BOOK_ROLEPLAY[bookSlug];
  const hasSpecifiedCharacter = !!(isPlayerMode ? aiCharacterId : activeCharacterId);
  const isRoleplay = isPlayerMode || !!aiCharacter || (!hasSpecifiedCharacter && !!legacyRoleplay?.enabled);

  // 计算显示名称和头像
  const aiName = aiCharacter?.name || (!hasSpecifiedCharacter ? (legacyRoleplay?.characterName || bookTitle) : bookTitle);
  const aiAvatar = aiCharacter?.avatar || (!hasSpecifiedCharacter ? (legacyRoleplay?.avatar || '✦') : '✦');
  const playerName = playerCharacter?.name || (playerCharacterId ? playerCharacterId : '你');
  const playerAvatar = playerCharacter?.avatar || '🎭';

  // 根据当前人物数据生成问候语（props 在渲染前就已注入，无竞态问题）
  const buildGreeting = () => {
    if (isPlayerMode) {
      const pName = playerCharacter?.name || playerCharacterId || '你';
      const aName = aiCharacter?.name || '';
      return `（${aName} 看了你一眼）\n\n……你是${pName}？说吧，有什么事？`;
    }
    if (aiCharacter) {
      return `你好，我是${aiCharacter.name}。有什么想问我的？`;
    }
    if (!hasSpecifiedCharacter && legacyRoleplay?.enabled) {
      return legacyRoleplay.greeting;
    }
    return `你好！我是《${bookTitle}》的 AI 助手。你可以问我关于这本书的任何问题。`;
  };

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: buildGreeting() },
  ]);

  const [input, setInput] = useState('');
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle');
  const [buildMsg, setBuildMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 静态导出下 router.query 在客户端水合后才有值，此时 props 刚变为真实值
  // 监听 id 变化，如果对话还在初始状态就更新问候语和当前角色
  useEffect(() => {
    const newActiveId = isPlayerMode ? aiCharacterId : initialCharacterId;
    console.log('[BookChat useEffect] triggered, newActiveId:', newActiveId, '| characters:', characters.map(c => c.id), '| messages.length:', messages.length);
    setActiveCharacterId(newActiveId);
    setMessages(prev => {
      // 只有当对话还只有一条消息（初始问候语）时才刷新，避免覆盖已有对话
      if (prev.length === 1) {
        const targetChar = characters.find(c => c.id === newActiveId);
        const plChar = isPlayerMode ? characters.find(c => c.id === playerCharacterId) : null;
        let greeting: string;
        if (isPlayerMode) {
          greeting = `（${targetChar?.name || ''} 看了你一眼）\n\n……你是${plChar?.name || playerCharacterId || '你'}？说吧，有什么事？`;
        } else if (targetChar) {
          greeting = `你好，我是${targetChar.name}。有什么想问我的？`;
        } else if (!newActiveId && legacyRoleplay?.enabled) {
          greeting = legacyRoleplay.greeting;
        } else {
          greeting = `你好！我是《${bookTitle}》的 AI 助手。你可以问我关于这本书的任何问题。`;
        }
        return [{ role: 'assistant', content: greeting }];
      }
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCharacterId, playerCharacterId, aiCharacterId]);

  // 当模式或人物变更时，重置对话
  const resetConversation = (newCharacterId?: string) => {
    setActiveCharacterId(newCharacterId);
    const newAiChar = characters.find(c => c.id === newCharacterId);
    const newGreeting = newAiChar
      ? `你好，我是${newAiChar.name}。有什么想问我的？`
      : (legacyRoleplay?.greeting || `你好！我是《${bookTitle}》的 AI 助手。`);
    setMessages([{ role: 'assistant', content: newGreeting }]);
    setInput('');
  };

  const handleBuild = async () => {
    if (buildStatus === 'building') return;
    setBuildStatus('building');
    setBuildMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/rag/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '构建失败');
      setBuildStatus('success');
      setBuildMsg(`构建成功，共 ${data.docCount} 个片段`);
    } catch (error) {
      setBuildStatus('error');
      setBuildMsg(error instanceof Error ? error.message : '构建失败');
    } finally {
      setTimeout(() => setBuildStatus('idle'), 4000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    setStreaming(false);

    try {
      // 构建请求体，根据模式传递不同参数
      const requestBody: Record<string, string> = {
        question,
        bookSlug,
      };

      if (isPlayerMode) {
        // 玩家扮演模式：AI 扮演 aiCharacterId，玩家扮演 playerCharacterId
        if (aiCharacterId) requestBody.characterId = aiCharacterId;
        if (playerCharacterId) requestBody.playerCharacterId = playerCharacterId;
      } else if (activeCharacterId) {
        // 读者模式：传入指定的角色 ID
        requestBody.characterId = activeCharacterId;
      }

      const res = await fetch(`${API_BASE}/api/rag/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ message: '请求失败' }));
        throw new Error(err.message || '请求失败');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let pendingSources: Source[] | undefined;
      let assistantMsgAdded = false;
      let serverError: string | null = null;
      let shouldClose = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        let eventName = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const raw = line.slice(5).trim();
            try {
              const data = JSON.parse(raw) as { text?: string; type?: 'thinking' | 'answer'; code?: string; message?: string };
              if (eventName === 'sources') {
                pendingSources = data as unknown as Source[];
              } else if (eventName === 'delta') {
                if (!assistantMsgAdded) {
                  setMessages((prev) => [...prev, { role: 'assistant', content: '', thinking: '' }]);
                  assistantMsgAdded = true;
                }
                setStreaming(true);

                const deltaType = data.type ?? 'answer';
                const deltaText = data.text ?? '';

                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last.role === 'assistant') {
                    if (deltaType === 'thinking') {
                      next[next.length - 1] = { ...last, thinking: (last.thinking ?? '') + deltaText };
                    } else {
                      next[next.length - 1] = { ...last, content: last.content + deltaText };
                    }
                  }
                  return next;
                });
              } else if (eventName === 'done') {
                setStreaming(false);
                if (pendingSources) {
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last.role === 'assistant') {
                      next[next.length - 1] = { ...last, sources: pendingSources };
                    }
                    return next;
                  });
                }
                shouldClose = true;
              } else if (eventName === 'error') {
                if (data.code === 'content_filter') {
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last?.role === 'assistant') {
                      next[next.length - 1] = { role: 'assistant', content: '🔒 这个问题触发了安全策略，没办法回答。换个方式问试试？' };
                    } else {
                      next.push({ role: 'assistant', content: '🔒 这个问题触发了安全策略，没办法回答。换个方式问试试？' });
                    }
                    return next;
                  });
                  shouldClose = true;
                } else {
                  serverError = data.message || '服务器错误';
                }
              }
            } catch {
              // 忽略 JSON 解析失败
            }
            eventName = '';
          }
        }

        if (shouldClose) {
          reader.cancel();
          break;
        }
      }

      if (serverError) throw new Error(serverError);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && last.content === '') {
          next[next.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` };
        } else {
          next.push({ role: 'assistant', content: `⚠️ ${msg}` });
        }
        return next;
      });
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const BOOK_SUGGESTIONS: Record<string, string[]> = {
    'wo-kanjian-de-shijie': [
      '李飞飞的童年经历是怎样的？',
      '她是如何走上 AI 研究之路的？',
      'ImageNet 项目是怎么诞生的？',
      '书中最令你印象深刻的观点是什么？',
    ],
    'dao-gui-yi-xian': [
      '你为什么会同时活在两个世界里？',
      '丹阳子师傅是个什么样的人？',
      '你从幻觉里带回来过什么东西？',
      '你觉得自己到底是病人还是修仙者？',
    ],
  };
  const suggestions = BOOK_SUGGESTIONS[bookSlug] || BOOK_SUGGESTIONS['wo-kanjian-de-shijie'];

  const lastMsgIdx = messages.length - 1;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link href={`/book/${bookSlug}/world`} className={styles.backBtn}>
          ← 返回世界
        </Link>
        <div className={styles.headerTitle}>
          <span className={styles.aiIcon}>{isPlayerMode ? playerAvatar : aiAvatar}</span>
          <span>
            {isPlayerMode
              ? `${playerName} × ${aiName}`
              : isRoleplay ? `与${aiName}对话` : `与《${bookTitle}》对话`}
          </span>
        </div>
        <div className={styles.headerRight}>
          {/* 切换人物按钮（仅读者模式且有多个人物时显示） */}
          {!isPlayerMode && characters.length > 1 && (
            <button
              className={styles.switchCharBtn}
              onClick={() => setShowPicker(true)}
              title="切换对话人物"
            >
              👥
            </button>
          )}
          <button
            className={`${styles.buildBtn} ${styles[`buildBtn_${buildStatus}`]}`}
            onClick={handleBuild}
            disabled={buildStatus === 'building'}
            title={buildMsg || '构建向量库'}
          >
            {buildStatus === 'building' ? '构建中…' : buildStatus === 'success' ? '✓ 成功' : buildStatus === 'error' ? '✗ 失败' : '⚙ 构建'}
          </button>
        </div>
      </div>

      {/* 玩家扮演模式：身份标识横幅 */}
      {isPlayerMode && (
        <div className={styles.playerModeBanner}>
          <div className={styles.playerModeBannerInner}>
            <span className={styles.playerModeTag}>
              <span>{playerAvatar}</span>
              <span>你正在扮演：<strong>{playerName}</strong></span>
            </span>
            <span className={styles.playerModeSep}>↔</span>
            <span className={styles.playerModeTag}>
              <span>{aiAvatar}</span>
              <span>对话对象：<strong>{aiName}</strong></span>
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}>
            {msg.role === 'assistant' && (
              <div className={styles.avatar} title={aiName}>
                {aiAvatar}
              </div>
            )}
            <div className={styles.bubble}>
              {/* 玩家扮演模式：AI 发言前显示角色名 */}
              {msg.role === 'assistant' && isPlayerMode && (
                <div className={styles.speakerLabel}>{aiName} 对你说：</div>
              )}
              {msg.role === 'assistant' && msg.thinking && (
                <ThinkingBlock
                  thinking={msg.thinking}
                  isStreaming={streaming && i === lastMsgIdx && msg.content === ''}
                />
              )}
              {(msg.content || msg.role === 'user') && (
                <p className={`${styles.bubbleText} ${msg.role === 'assistant' && streaming && i === lastMsgIdx ? styles.streamingCursor : ''}`}>
                  {msg.content}
                </p>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className={styles.sources}>
                  <p className={styles.sourcesLabel}>引用来源：</p>
                  {msg.sources.map((src, j) => (
                    <div key={j} className={styles.sourceItem}>
                      <span className={styles.sourceChapter}>{src.chapterTitle}</span>
                      <p className={styles.sourceExcerpt}>{src.excerpt}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && !streaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className={`${styles.message} ${styles.assistantMessage}`}>
            <div className={styles.avatar}>{aiAvatar}</div>
            <div className={styles.bubble}>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions（仅第一条问候语时展示） */}
      {messages.length === 1 && (
        <div className={styles.suggestions}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              className={styles.suggestionBtn}
              onClick={() => setInput(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 玩家扮演模式输入区提示 */}
      {isPlayerMode && (
        <div className={styles.playerInputHint}>
          <span>{playerAvatar}</span>
          <span>以「{playerName}」的身份发言</span>
        </div>
      )}

      {/* Input */}
      <form className={styles.inputForm} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isPlayerMode
              ? `以 ${playerName} 的身份说些什么…`
              : hasSpecifiedCharacter
              ? `向${aiName}提问…`
              : isRoleplay
              ? (BOOK_ROLEPLAY[bookSlug]?.placeholder || `向${aiName}提问…`)
              : '向 AI 提问关于这本书的内容…'
          }
          disabled={loading}
          maxLength={500}
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={loading || !input.trim()}
        >
          发送
        </button>
      </form>

      {/* 人物切换选择器 */}
      {showPicker && (
        <CharacterPicker
          characters={characters}
          currentId={activeCharacterId || null}
          onSelect={(id) => resetConversation(id)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
