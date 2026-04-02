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
    // 不预先插入空占位消息，等收到第一个 delta 时再插入，避免等待期出现两个气泡

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
      let assistantMsgAdded = false; // 是否已插入 assistant 消息占位
      let serverError: string | null = null; // 收集服务端 error 事件内容

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
              const data = JSON.parse(raw);
              if (eventName === 'sources') {
                pendingSources = data as Source[];
              } else if (eventName === 'delta') {
                // 收到第一个 delta 时才插入 assistant 消息，消除双气泡
                if (!assistantMsgAdded) {
                  setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
                  assistantMsgAdded = true;
                }
                setStreaming(true);
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last.role === 'assistant') {
                    next[next.length - 1] = {
                      ...last,
                      content: last.content + (data.text ?? ''),
                    };
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
                // 用变量收集，不在此处 throw（会被内层 catch 吞掉）
                serverError = data.message || '服务器错误';
              }
            } catch {
              // 忽略 JSON 解析失败
            }
            eventName = '';
          }
        }
      }

      // 流结束后统一处理服务端错误
      if (serverError) {
        throw new Error(serverError);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        // 有空占位消息则替换，否则新增一条带警告图标的错误消息
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
              <p className={`${styles.bubbleText} ${msg.role === 'assistant' && streaming && i === messages.length - 1 ? styles.streamingCursor : ''}`}>
                {msg.content}
              </p>
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

        {/* loading 且尚未收到 delta（还没开始流输出）时，显示三点等待动画 */}
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
