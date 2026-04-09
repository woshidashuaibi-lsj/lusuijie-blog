'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
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
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

// 每本书的角色扮演配置
const BOOK_ROLEPLAY: Record<string, { enabled: boolean; characterName: string; avatar: string; greeting: string; placeholder: string }> = {
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

export default function BookChat({ bookSlug, bookTitle }: BookChatProps) {
  const roleplay = BOOK_ROLEPLAY[bookSlug];
  const isRoleplay = !!roleplay?.enabled;

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: isRoleplay
        ? roleplay.greeting
        : `你好！我是《${bookTitle}》的 AI 助手。你可以问我关于这本书的任何问题，我会基于书中内容为你解答。`,
    },
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
      const res = await fetch(`${API_BASE}/api/rag/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, bookSlug }),
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
                // 收到第一个 delta 时插入 assistant 占位消息
                if (!assistantMsgAdded) {
                  setMessages((prev) => [...prev, { role: 'assistant', content: '', thinking: '' }]);
                  assistantMsgAdded = true;
                }
                setStreaming(true);

                const deltaType = data.type ?? 'answer'; // 兼容旧协议（无 type 字段时当 answer）
                const deltaText = data.text ?? '';

                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last.role === 'assistant') {
                    if (deltaType === 'thinking') {
                      next[next.length - 1] = {
                        ...last,
                        thinking: (last.thinking ?? '') + deltaText,
                      };
                    } else {
                      next[next.length - 1] = {
                        ...last,
                        content: last.content + deltaText,
                      };
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
              } else if (eventName === 'error') {
                if (data.code === 'content_filter') {
                  // 内容安全策略触发，直接设置友好提示，不走通用错误流程
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last?.role === 'assistant' && last.content === '') {
                      next[next.length - 1] = {
                        role: 'assistant',
                        content: '🔒 这个问题触发了安全策略，没办法回答。换个方式问试试？',
                      };
                    } else {
                      next.push({
                        role: 'assistant',
                        content: '🔒 这个问题触发了安全策略，没办法回答。换个方式问试试？',
                      });
                    }
                    return next;
                  });
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
      }

      if (serverError) {
        throw new Error(serverError);
      }
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

  // 当前最后一条消息是否在流式输出中
  const lastMsgIdx = messages.length - 1;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link href={`/book/${bookSlug}`} className={styles.backBtn}>
          ← 返回阅读
        </Link>
        <div className={styles.headerTitle}>
          <span className={styles.aiIcon}>{isRoleplay ? roleplay.avatar : '✦'}</span>
          <span>{isRoleplay ? `与${roleplay.characterName}对话` : `与《${bookTitle}》对话`}</span>
        </div>
        <div className={styles.headerRight}>
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

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}>
            {msg.role === 'assistant' && (
              <div className={styles.avatar} title={isRoleplay ? roleplay.characterName : 'AI'}>
                {isRoleplay ? roleplay.avatar : '✦'}
              </div>
            )}
            <div className={styles.bubble}>
              {/* 思考过程块（仅 assistant 且有 thinking 内容时展示）*/}
              {msg.role === 'assistant' && msg.thinking && (
                <ThinkingBlock
                  thinking={msg.thinking}
                  isStreaming={streaming && i === lastMsgIdx && msg.content === ''}
                />
              )}
              {/* 正式回答 */}
              {(msg.content || msg.role === 'user') && (
                <p className={`${styles.bubbleText} ${msg.role === 'assistant' && streaming && i === lastMsgIdx ? styles.streamingCursor : ''}`}>
                  {msg.content}
                </p>
              )}
              {/* 引用来源 */}
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

        {/* loading 且尚未收到 delta 时，显示三点等待动画 */}
        {loading && !streaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className={`${styles.message} ${styles.assistantMessage}`}>
            <div className={styles.avatar}>{isRoleplay ? roleplay.avatar : '✦'}</div>
            <div className={styles.bubble}>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
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

      {/* Input */}
      <form className={styles.inputForm} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRoleplay ? roleplay.placeholder : '向 AI 提问关于这本书的内容…'}
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
    </div>
  );
}
