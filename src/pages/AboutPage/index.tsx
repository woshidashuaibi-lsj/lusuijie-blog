import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import styles from './index.module.css';

const skills = [
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'Node.js',
  'Python',
  'Git',
  'Docker',
];

const interests = [
  '🚀 前端技术',
  '📚 技术写作',
  '🎵 音乐',
  '📖 阅读',
  '🏃‍♂️ 跑步',
  '🎮 游戏',
];

export default function AboutPage() {
  const heroBgRef = useRef<HTMLImageElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const bgEl = heroBgRef.current;
    const sectionEl = sectionRef.current;
    if (!bgEl || !sectionEl) return;

    // 只在移动端（触摸设备或小屏幕）启用 JS 视差
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return;

    let rafId: number;

    const onScroll = () => {
      rafId = requestAnimationFrame(() => {
        const rect = sectionEl.getBoundingClientRect();
        // 计算视差偏移：section 在视口中的位置 × 视差系数（0.35 = 慢 35% 滚动速度）
        const parallaxY = -rect.top * 0.35;
        bgEl.style.transform = `translateY(${parallaxY}px)`;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // 初始执行一次
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <Navigation />
      <div className="container">
        <div className={styles.aboutPage}>
          {/* 个人简介区域 */}
          <section className={styles.heroSection} ref={sectionRef}>
            {/* 移动端视差背景图（JS 控制 transform） */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={heroBgRef}
              src="/images/hero-bg.jpg"
              alt=""
              aria-hidden="true"
              className={styles.heroBg}
            />

            <div className={styles.avatarContainer}>
            </div>
            <div className={styles.introText}>
              <h1 className={styles.name}>你好，我是卢穗杰 👋</h1>
              <p className={styles.subtitle}>一名热爱技术的前端开发者</p>
              <p className={styles.description}>
                欢迎来到我的个人博客！我是一名充满热情的前端开发者，
                喜欢探索新技术，分享学习心得，并通过代码创造有价值的产品。
                在这里，我会分享我的技术学习笔记、项目经验以及对技术的思考。
              </p>
            </div>
          </section>

          {/* 技能栈区域 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>🛠️ 技能栈</h2>
            <div className={styles.skillsGrid}>
              {skills.map((skill) => (
                <div key={skill} className={styles.skillTag}>
                  {skill}
                </div>
              ))}
            </div>
          </section>
          

          {/* 关于我区域 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>👨‍💻 关于我</h2>
            <div>让我想想该怎么介绍自己</div>
          </section>

          {/* 兴趣爱好区域 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>🎯 兴趣爱好</h2>
            <div className={styles.interestsGrid}>
              {interests.map((interest) => (
                <div key={interest} className={styles.interestItem}>
                  {interest}
                </div>
              ))}
            </div>
          </section>

          {/* 联系方式区域 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>📫 联系我</h2>
            <div className={styles.contactGrid}>
              <Link 
                href="https://github.com/woshidashuaibi-lsj" 
                className={styles.contactItem}
                target="_blank"
              >
                <span className={styles.contactIcon}>🐙</span>
                <span>GitHub</span>
              </Link>
              <Link 
                href="mailto:1275662488@qq.com" 
                className={styles.contactItem}
              >
                <span className={styles.contactIcon}>📧</span>
                <span>Email</span>
              </Link>
              <div className={styles.contactItem}>
                <span className={styles.contactIcon}>📍</span>
                <span>中国</span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
