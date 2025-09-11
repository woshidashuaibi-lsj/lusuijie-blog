'use client';

import { useEffect, useState } from 'react';
import styles from './index.module.css';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  htmlContent: string;
}

export default function TableOfContents({ htmlContent }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const headingElements = tempDiv.querySelectorAll('h1, h2, h3, h4');
    const headingList: Heading[] = [];

    headingElements.forEach((heading, index) => {
      const text = heading.textContent || '';
      const id = text
        .replace(/\s+/g, '-')
        .replace(/[^\w\-\u4e00-\u9fff]/g, '')
        .toLowerCase() || `heading-${index}`;
      
      headingList.push({
        id,
        text,
        level: parseInt(heading.tagName.charAt(1)),
      });
      
      // 为实际 DOM 中的标题添加 ID
      setTimeout(() => {
        const realHeadings = document.querySelectorAll(`h${heading.tagName.charAt(1)}`);
        if (realHeadings[index]) {
          realHeadings[index].id = id;
        }
      }, 100);
    });

    setHeadings(headingList);
  }, [htmlContent]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-100px 0% -70%',
        threshold: 0.1,
      }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  return (
    <div className={styles.tableOfContents}>
      <h3 className={styles.title}>目录</h3>
      <nav className={styles.nav}>
        <ul className={styles.list}>
          {headings.map((heading) => (
            <li key={heading.id} className={styles.item}>
              <button
                onClick={() => handleClick(heading.id)}
                className={`${styles.link} ${styles[`level${heading.level}`]} ${
                  activeId === heading.id ? styles.active : ''
                }`}
                title={heading.text}
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}