import Image from 'next/image';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import styles from './index.module.css';
import RecommendTool from '@/components/TestTool';

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
  return (
    <>
      <Navigation />
      <div className="container">
        <div className={styles.aboutPage}>
          {/* 个人简介区域 */}
          <section className={styles.heroSection}>
            <div className={styles.avatarContainer}>
              <Image
                src="http://lusuijie.com.cn/images/avater.jpg" // 你需要在 public 目录下添加你的头像图片
                alt="卢穗杰"
                width={200}
                height={270}
                className={styles.avatar}
                priority
              />
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
            <div className={styles.aboutContent}>
              <div className={styles.aboutItem}>
                <h3>🎓 学习经历</h3>
                <p>
                  我在学习过程中专注于前端开发领域，热衷于学习最新的前端技术栈，
                  包括 React、Next.js、TypeScript 等现代前端技术。
                </p>
              </div>
              <div className={styles.aboutItem}>
                <h3>💼 项目经验</h3>
                <p>
                  参与过多个前端项目的开发，包括企业官网、管理后台、
                  个人博客等，具有丰富的实战经验。
                </p>
              </div>
              <div className={styles.aboutItem}>
                <h3>📝 技术分享</h3>
                <p>
                  喜欢通过博客分享技术学习心得，记录开发过程中遇到的问题和解决方案，
                  希望能够帮助到其他开发者。
                </p>
              </div>
            </div>
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
                href="mailto:your-email@example.com" 
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