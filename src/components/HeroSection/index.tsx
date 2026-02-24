import Image from 'next/image';
import styles from './index.module.css';

export default function HeroSection() {
  return (
    <section className={styles.heroSection}>
      <div className="container">
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>卢穗杰</h1>
            <p className={styles.heroSubtitle}>百年后，浮教是载。三万六千场。</p>
            <p className={styles.heroDescription}>天真的理想主义者</p>
          </div>
          <div className={styles.heroAvatar}>
            <Image
              src="https://woshidashuaibi-lsj.github.io/dashuaibi-blog.github.io/avatar.png"
              alt="个人头像"
              width={150}
              height={150}
              className={styles.avatarImage}
            />
          </div>
        </div>
      </div>
    </section>
  );
}