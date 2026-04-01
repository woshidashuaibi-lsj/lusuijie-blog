#!/usr/bin/env python3
"""从 epub 文件提取文本内容"""

import sys
import json
import re
from ebooklib import epub

def extract_epub(epub_path):
    book = epub.read_epub(epub_path)
    
    chapters = []
    
    for item in book.get_items():
        if item.get_type() == 9:  # EPUB type 9 = HTML
            content = item.get_content().decode('utf-8')
            
            # 提取标题（从 <title> 或 <h1>）
            title_match = re.search(r'<title[^>]*>([^<]+)</title>', content)
            h1_match = re.search(r'<h1[^>]*>([^<]+)</h1>', content)
            title = title_match.group(1) if title_match else (h1_match.group(1) if h1_match else f"Chapter {len(chapters)+1}")
            
            # 清理 HTML 标签，提取纯文本
            text = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
            text = re.sub(r'<[^>]+>', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
            
            if len(text) > 100:  # 过滤太短的章节
                chapters.append({
                    'title': title.strip(),
                    'content': text
                })
    
    return chapters

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_epub.py <epub_path> [output_json_path]")
        sys.exit(1)
    
    epub_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    print(f"正在读取: {epub_path}")
    chapters = extract_epub(epub_path)
    
    print(f"提取到 {len(chapters)} 个章节")
    
    for i, ch in enumerate(chapters[:5]):
        print(f"\n--- 章节 {i+1}: {ch['title'][:50]} ---")
        print(ch['content'][:200] + "...")
    
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({'chapters': chapters}, f, ensure_ascii=False, indent=2)
        print(f"\n已保存到: {output_path}")

if __name__ == '__main__':
    main()
