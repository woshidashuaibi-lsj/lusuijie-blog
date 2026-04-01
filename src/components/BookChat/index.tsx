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

// FC API 地址：本地开发时为空（走 Next.js 自身的 /api），生产环境指向 FC 函数
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function BookChat({ bookSlug, bookTitle }: BookChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `你好！我是《${bookTitle}》的 AI 助手。你可以问我关于这本书的任何问题，我会基于书中内容为你解答。`,
    },
  ]);
  const [input, setInput] = useState('');
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle');
  const [buildMsg, setBuildMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleBuild = async () => {
    if (buildStatus === 'building') return;
    setBuildStatus('building');
    setBuildMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/rag/build`, { method: 'POST' });
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

    try {
      const res = await fetch(`${API_BASE}/api/rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || '请求失败');
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `抱歉，出现了错误：${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    '李飞飞的童年经历是怎样的？',
    '她是如何走上 AI 研究之路的？',
    'ImageNet 项目是怎么诞生的？',
    '书中最令你印象深刻的观点是什么？',
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link href={`/book/${bookSlug}`} className={styles.backBtn}>
          ← 返回阅读
        </Link>
        <div className={styles.headerTitle}>
          <span className={styles.aiIcon}>✦</span>
          <span>与《{bookTitle}》对话</span>
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
              <div className={styles.avatar}>✦</div>
            )}
            <div className={styles.bubble}>
              <p className={styles.bubbleText}>{msg.content}</p>
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

        {loading && (
          <div className={`${styles.message} ${styles.assistantMessage}`}>
            <div className={styles.avatar}>✦</div>
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
          placeholder="向 AI 提问关于这本书的内容..."
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
