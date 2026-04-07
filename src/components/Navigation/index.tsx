import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ThemeToggle from '@/components/ThemeToggle';
import styles from './index.module.css';

// 主导航配置
const navItems = [
  { href: '/', label: '主页' },
  { href: '/blog', label: '文章' },
  { href: '/photo', label: '照片墙' },
  { href: '/guestbook', label: '留言板' },
  { href: '/book', label: '书单' },
  { href: '/daily', label: '日报' },
  { href: '/about', label: '关于我' },
];

// 外链按钮配置
const externalLinks = [
  {
    href: 'https://github.com/woshidashuaibi-lsj',
    label: 'GitHub',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.23 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    )
  },
];

export default function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  // 路由切换时关闭菜单
  useEffect(() => {
    const handleRouteChange = () => setMenuOpen(false);
    router.events.on('routeChangeStart', handleRouteChange);
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router.events]);

  // 菜单打开时禁止 body 滚动
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <nav className={styles.nav}>
      <div className="container">
        <div className={styles.navContent}>
          {/* Logo / 站点名 */}
          <Link href="/" className={styles.logo}>
            LUSUIJIE
          </Link>

          {/* 桌面端导航链接 */}
          <ul className={styles.navLinks}>
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.navLink} ${router.pathname === item.href ? styles.navLinkActive : ''}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* 右侧按钮组（桌面端） */}
          <div className={styles.rightActions}>
            {externalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={styles.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                title={link.label}
                aria-label={link.label}
              >
                {link.icon}
              </Link>
            ))}
            <ThemeToggle />

            {/* 汉堡菜单按钮（仅移动端显示） */}
            <button
              className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
              aria-expanded={menuOpen}
            >
              <span className={styles.hamburgerLine} />
              <span className={styles.hamburgerLine} />
              <span className={styles.hamburgerLine} />
            </button>
          </div>
        </div>
      </div>

      {/* 移动端抽屉菜单 */}
      {menuOpen && (
        <div className={styles.overlay} onClick={() => setMenuOpen(false)} />
      )}
      <div className={`${styles.drawer} ${menuOpen ? styles.drawerOpen : ''}`}>
        <ul className={styles.drawerLinks}>
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`${styles.drawerLink} ${router.pathname === item.href ? styles.drawerLinkActive : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className={styles.drawerExternal}>
          {externalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              title={link.label}
              aria-label={link.label}
            >
              {link.icon}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
