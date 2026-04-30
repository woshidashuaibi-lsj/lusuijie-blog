'use client';
/**
 * ChapterWriter - 章节创作主界面
 * 三栏布局：章节列表 + 富文本编辑器 + 伏笔面板
 * 核心功能：调用记忆系统构建 Story Bible，SSE 流式生成章节
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { NovelProject, Chapter, ChapterStatus } from '@/types/novel';
import { buildStoryBibleContext, buildSystemPrompt } from '@/lib/novelContext';
import { createSnapshot } from '@/lib/novelDB';
import ForeshadowPanel from './ForeshadowPanel';
import StoryBibleDrawer from './StoryBibleDrawer';
import StoryboardPanel from './Storyboard';
import type { StoryboardScene } from '@/types/storyboard';
import styles from './ChapterWriter.module.css';

// 小说创作 API 已迁移到 fc-api 云服务，线上走 NEXT_PUBLIC_API_BASE，本地开发走相对路径
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface Props {
  project: NovelProject;
  onUpdate: (updater: (p: NovelProject) => NovelProject) => void;
  onBackToWizard: () => void;
}

// 中文字数统计
function countWords(text: string): number {
  return text.replace(/\s/g, '').length;
}

export default function ChapterWriter({ project, onUpdate, onBackToWizard }: Props) {
  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    project.chapters.find(c => c.status !== 'done')?.id || project.chapters[project.chapters.length - 1]?.id || null
  );
  const [generating, setGenerating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ dimension: string; issue: string; suggestion: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showBible, setShowBible] = useState(false);
  const [showForeshadow, setShowForeshadow] = useState(false);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [error, setError] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const activeChapter = project.chapters.find(c => c.id === activeChapterId);

  // 滚动到编辑器底部（生成中）
  useEffect(() => {
    if (generating && editorRef.current) {
      editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  }, [generating, activeChapter?.content]);

  // ── 添加新章节 ──
  const addNewChapter = useCallback(() => {
    const nextNum = (project.chapters[project.chapters.length - 1]?.number ?? 0) + 1;
    // 找到对应的情节幕
    const act = project.plotActs.find(
      a => nextNum >= a.chapterRange[0] && nextNum <= a.chapterRange[1]
    );
    const newChapter: Chapter = {
      id: uuidv4(),
      number: nextNum,
      title: `第${nextNum}章`,
      plotActId: act?.id || '',
      status: 'pending',
      content: '',
      summary: '',
      wordCount: 0,
      foreshadowIds: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onUpdate(p => ({ ...p, chapters: [...p.chapters, newChapter] }));
    setActiveChapterId(newChapter.id);
  }, [project.chapters, project.plotActs, onUpdate]);

  // ── 生成章节（核心：注入完整 Story Bible）──
  const generateChapter = useCallback(async () => {
    if (!activeChapter || generating) return;
    setError('');
    setGenerating(true);

    // 更新章节状态为 generating
    onUpdate(p => ({
      ...p,
      chapters: p.chapters.map(c =>
        c.id === activeChapter.id ? { ...c, status: 'generating' as ChapterStatus } : c
      ),
    }));

    try {
      // ★ 核心：从记忆系统构建 Story Bible 上下文
      const ctx = buildStoryBibleContext(project, activeChapter.number);
      const systemPrompt = buildSystemPrompt(ctx);

      const res = await fetch(`${API_BASE}/api/novel/generate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          chapterNumber: activeChapter.number,
          chapterTitle: activeChapter.title,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ message: '请求失败' }));
        throw new Error(err.message || '章节生成失败');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let accumulated = '';

      // 清空现有内容，准备流式接收
      onUpdate(p => ({
        ...p,
        chapters: p.chapters.map(c =>
          c.id === activeChapter.id ? { ...c, content: '', status: 'generating' as ChapterStatus } : c
        ),
      }));

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
              if (eventName === 'delta' && data.text) {
                accumulated += data.text;
                const capturedAccumulated = accumulated;
                const capturedId = activeChapter.id;
                onUpdate(p => ({
                  ...p,
                  chapters: p.chapters.map(c =>
                    c.id === capturedId
                      ? { ...c, content: capturedAccumulated }
                      : c
                  ),
                }));
              } else if (eventName === 'done') {
                reader.cancel();
                break;
              } else if (eventName === 'error') {
                throw new Error(data.message || '生成出错');
              }
            } catch (parseErr) {
              if ((parseErr as Error).message !== 'JSON Parse error') {
                // 非 JSON 解析错误，重新抛出
                if (eventName === 'error') throw parseErr;
              }
            }
            eventName = '';
          }
        }
      }

      // 生成完成，更新状态和字数
      const wordCount = countWords(accumulated);
      const capturedFinalContent = accumulated;
      const capturedChapterId = activeChapter.id;
      onUpdate(p => ({
        ...p,
        chapters: p.chapters.map(c =>
          c.id === capturedChapterId
            ? {
                ...c,
                content: capturedFinalContent,
                wordCount,
                status: 'draft' as ChapterStatus,
                updatedAt: Date.now(),
              }
            : c
        ),
      }));

      // 自动生成摘要（后台触发，不阻塞用户）
      autoGenerateSummary(activeChapter.id, capturedFinalContent, activeChapter.number, activeChapter.title);

    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试');
      onUpdate(p => ({
        ...p,
        chapters: p.chapters.map(c =>
          c.id === activeChapter.id ? { ...c, status: 'pending' as ChapterStatus } : c
        ),
      }));
    } finally {
      setGenerating(false);
    }
  }, [activeChapter, project, generating, onUpdate]);

  // ── 自动生成章节摘要 ──
  const autoGenerateSummary = async (
    chapterId: string,
    content: string,
    chapterNumber: number,
    title: string
  ) => {
    try {
      const res = await fetch(`${API_BASE}/api/novel/summarize/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, chapterNumber, title }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.summary) {
        onUpdate(p => ({
          ...p,
          chapters: p.chapters.map(c =>
            c.id === chapterId ? { ...c, summary: data.summary } : c
          ),
        }));
      }
    } catch {
      // 摘要生成失败不影响主流程
    }
  };

  // ── 标记章节完成 ──
  const markChapterDone = useCallback(() => {
    if (!activeChapter) return;
    onUpdate(p => ({
      ...p,
      chapters: p.chapters.map(c =>
        c.id === activeChapter.id
          ? { ...c, status: 'done' as ChapterStatus, updatedAt: Date.now() }
          : c
      ),
    }));
    // 创建快照
    createSnapshot(project, `第${activeChapter.number}章完成后`).catch(() => {});
  }, [activeChapter, project, onUpdate]);

  // ── 获取 AI 修改建议 ──
  const getSuggestions = useCallback(async () => {
    if (!activeChapter?.content) return;
    setSuggesting(true);
    setSuggestions([]);
    setShowSuggestions(true);
    try {
      const ctx = buildStoryBibleContext(project, activeChapter.number);
      const res = await fetch(`${API_BASE}/api/novel/suggest/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: activeChapter.content,
          worldContext: ctx.worldSummary,
          chapterNumber: activeChapter.number,
        }),
      });
      const data = await res.json();
      if (res.ok && data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch {
      setError('获取建议失败');
    } finally {
      setSuggesting(false);
    }
  }, [activeChapter, project]);

  // ── 编辑内容更新 ──
  const handleContentChange = useCallback((val: string) => {
    if (!activeChapterId) return;
    const wc = countWords(val);
    onUpdate(p => ({
      ...p,
      chapters: p.chapters.map(c =>
        c.id === activeChapterId
          ? { ...c, content: val, wordCount: wc, updatedAt: Date.now() }
          : c
      ),
    }));
  }, [activeChapterId, onUpdate]);

  const handleTitleChange = useCallback((val: string) => {
    if (!activeChapterId) return;
    onUpdate(p => ({
      ...p,
      chapters: p.chapters.map(c =>
        c.id === activeChapterId ? { ...c, title: val } : c
      ),
    }));
  }, [activeChapterId, onUpdate]);

  const STATUS_CONFIG: Record<ChapterStatus, { label: string; color: string }> = {
    pending: { label: '待写', color: '#6b7280' },
    generating: { label: '生成中…', color: '#a78bfa' },
    draft: { label: '草稿', color: '#f59e0b' },
    done: { label: '完成', color: '#34d399' },
  };

  const totalWords = project.chapters.reduce((s, c) => s + c.wordCount, 0);
  const doneCount = project.chapters.filter(c => c.status === 'done').length;

  return (
    <div className={styles.container}>
      {/* ── 顶部工具栏 ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className={styles.toolBtn} onClick={onBackToWizard} title="返回设定">
            ← 设定
          </button>
          <div className={styles.novelTitle}>{project.title}</div>
        </div>
        <div className={styles.toolbarCenter}>
          <span className={styles.stat}>{totalWords.toLocaleString()} 字</span>
          <span className={styles.statDivider}>·</span>
          <span className={styles.stat}>{doneCount}/{project.chapters.length} 章</span>
        </div>
        <div className={styles.toolbarRight}>
          <button
            className={`${styles.toolBtn} ${showBible ? styles.toolBtnActive : ''}`}
            onClick={() => setShowBible(v => !v)}
            title="故事圣经"
          >
            📖 故事圣经
          </button>
        </div>
      </div>

      {/* ── 主体三栏 ── */}
      <div className={styles.body}>
        {/* 左栏：章节列表 */}
        <div className={styles.sidebarLeft}>
          <div className={styles.sidebarHeader}>章节列表</div>
          <div className={styles.chapterList}>
            {project.chapters.map(ch => {
              const conf = STATUS_CONFIG[ch.status];
              return (
                <button
                  key={ch.id}
                  className={`${styles.chapterItem} ${ch.id === activeChapterId ? styles.chapterActive : ''}`}
                  onClick={() => setActiveChapterId(ch.id)}
                >
                  <div className={styles.chapterNum}>第{ch.number}章</div>
                  <div className={styles.chapterTitle}>{ch.title}</div>
                  <div className={styles.chapterStatus} style={{ color: conf.color }}>
                    {conf.label}
                  </div>
                  {ch.wordCount > 0 && (
                    <div className={styles.chapterWords}>{ch.wordCount}字</div>
                  )}
                </button>
              );
            })}
            <button className={styles.addChapterBtn} onClick={addNewChapter}>
              + 新章节
            </button>
          </div>
        </div>

        {/* 中栏：编辑器 */}
        <div className={styles.editorArea}>
          {activeChapter ? (
            <>
              {/* 章节标题 */}
              <input
                className={styles.chapterTitleInput}
                value={activeChapter.title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="章节标题"
              />

              {/* 操作按钮 */}
              <div className={styles.editorActions}>
                <button
                  className={styles.generateBtn}
                  onClick={generateChapter}
                  disabled={generating || activeChapter.status === 'done'}
                >
                  {generating ? (
                    <span>✦ AI 正在创作<span className={styles.cursor}>▊</span></span>
                  ) : activeChapter.content ? '✦ 重新生成' : '✦ AI 生成本章'}
                </button>

                {activeChapter.content && !generating && (
                  <>
                    <button
                      className={styles.actionBtn}
                      onClick={getSuggestions}
                      disabled={suggesting}
                    >
                      {suggesting ? '分析中…' : '✎ AI 修改建议'}
                    </button>
                    {activeChapter.status !== 'done' && (
                      <button className={styles.doneBtn} onClick={markChapterDone}>
                        ✓ 标记完成
                      </button>
                    )}
                  </>
                )}

                <button
                  className={`${styles.actionBtn} ${showForeshadow ? styles.toolBtnActive : ''}`}
                  onClick={() => setShowForeshadow(v => !v)}
                >
                  🧵 伏笔
                </button>
                <button
                  className={`${styles.actionBtn} ${showStoryboard ? styles.toolBtnActive : ''}`}
                  onClick={() => {
                    setShowStoryboard(v => !v);
                    setShowForeshadow(false);
                  }}
                >
                  🎬 分镜
                </button>
              </div>

              {error && (
                <div className={styles.errorMsg}>{error}</div>
              )}

              {/* 正文编辑器 */}
              <textarea
                ref={editorRef}
                className={styles.editor}
                value={activeChapter.content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder={generating ? '' : '点击"AI 生成本章"，或者直接在这里输入内容…'}
                disabled={generating}
              />

              {/* 字数显示 */}
              <div className={styles.wordCountBar}>
                {activeChapter.wordCount > 0 && (
                  <span>{activeChapter.wordCount.toLocaleString()} 字</span>
                )}
                {activeChapter.summary && (
                  <span className={styles.summaryBadge}>✓ 摘要已生成</span>
                )}
              </div>

              {/* AI 修改建议面板 */}
              {showSuggestions && suggestions.length > 0 && (
                <div className={styles.suggestionsPanel}>
                  <div className={styles.suggestionsHeader}>
                    <span>AI 修改建议</span>
                    <button onClick={() => setShowSuggestions(false)}>✕</button>
                  </div>
                  {suggestions.map((s, i) => (
                    <div key={i} className={styles.suggestionItem}>
                      <div className={styles.suggestionDimension}>{s.dimension}</div>
                      <div className={styles.suggestionIssue}>问题：{s.issue}</div>
                      <div className={styles.suggestionText}>建议：{s.suggestion}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyEditor}>
              <div className={styles.emptyEditorIcon}>✦</div>
              <p>选择左侧章节开始创作<br />或点击&ldquo;新章节&rdquo;开始第一章</p>
              <button className={styles.generateBtn} onClick={addNewChapter}>
                开始第一章
              </button>
            </div>
          )}
        </div>

        {/* 右栏：伏笔 / 分镜面板（互斥，可折叠） */}
        {(showForeshadow || showStoryboard) && (
          <div className={styles.sidebarRight}>
            {showForeshadow && (
              <ForeshadowPanel
                foreshadows={project.foreshadows}
                currentChapterNumber={activeChapter?.number ?? 1}
                onUpdate={(updater) => onUpdate(p => ({ ...p, foreshadows: updater(p.foreshadows) }))}
              />
            )}
            {showStoryboard && activeChapter && (
              <StoryboardPanel
                chapter={activeChapter}
                project={project}
                onStoryboardUpdate={(scene: StoryboardScene) => {
                  onUpdate(p => ({
                    ...p,
                    chapters: p.chapters.map(c =>
                      c.id === activeChapter.id ? { ...c, storyboard: scene } : c
                    ),
                  }));
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* 故事圣经抽屉 */}
      {showBible && (
        <StoryBibleDrawer
          project={project}
          onClose={() => setShowBible(false)}
          onImport={(imported) => onUpdate(() => imported)}
        />
      )}
    </div>
  );
}
