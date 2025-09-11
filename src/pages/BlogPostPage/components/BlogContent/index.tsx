import styles from './index.module.css';

interface BlogContentProps {
  htmlContent: string;
}

export default function BlogContent({ htmlContent }: BlogContentProps) {
  return (
    <div 
      className={`${styles.prose} prose`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}