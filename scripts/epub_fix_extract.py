#!/usr/bin/env python3
"""重新从 EPUB 提取内容，修复标题偏移问题并生成完整 JSON"""

import json
import re
from ebooklib import epub

def clean_html(content):
    text = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def get_real_title(content):
    """从 HTML 提取真实标题"""
    for pattern in [r'<h1[^>]*>(.*?)</h1>', r'<h2[^>]*>(.*?)</h2>', r'<title[^>]*>(.*?)</title>']:
        m = re.search(pattern, content, re.DOTALL)
        if m:
            title = re.sub(r'<[^>]+>', '', m.group(1)).strip()
            if title:
                return title
    return None

# 这些文件名对应的是书评赞誉部分（本书赞誉章节内的子页）
# 通过手动分析 EPUB 文件结构确认
APPENDIX_FILES = {
    '1717587639_split_016.html',  # 本书赞誉标题页
    '1717587639_split_017.html',  # 张亚勤
    '1717587639_split_018.html',  # 李开复
    '1717587639_split_019.html',  # 黄铁军
    '1717587639_split_020.html',  # 尹烨
    '1717587639_split_021.html',  # 陆雄文
    '1717587639_split_022.html',  # 马兆远
    '1717587639_split_023.html',  # 段伟文
    '1717587639_split_024.html',  # 之恒
    '1717587639_split_025.html',  # 蒋涛
    '1717587639_split_026.html',  # 霍太稳
    '1717587639_split_027.html',  # 李永乐
    '1717587639_split_028.html',  # 姜振宇
    '1717587639_split_029.html',  # 重磅导读（标题页，<50 chars）
    '1717587639_split_030.html',  # 傅盛
    '1717587639_split_031.html',  # 杨澜
    '1717587639_split_032.html',  # 符绩勋
    '1717587639_split_033.html',  # 程浩
    '1717587639_split_034.html',  # 快刀青衣
    '1717587639_split_035.html',  # 杨庆峰
}

# 正文章节文件名（手动对应）
MAIN_CHAPTER_FILES = [
    '1717587639_split_001.html',   # 01 如坐针毡的华盛顿之行
    '1717587639_split_002_split_001.html',  # 02 逐梦之旅 (内容)
    '1717587639_split_003_split_001.html',  # 03 鸿沟渐窄 (内容)
    '1717587639_split_004_split_001.html',  # 04 心智探索 (内容)
    '1717587639_split_005_split_001.html',  # 05 第一道光 (内容)
    '1717587639_split_006_split_001.html',  # 06 北极星 (内容)
    '1717587639_split_007_split_001.html',  # 07 一个假设 (内容)
    '1717587639_split_008_split_001.html',  # 08 实验验证 (内容)
    '1717587639_split_009_split_001.html',  # 09 万物以外是什么 (内容)
    '1717587639_split_010_split_001.html',  # 10 似易实难 (内容)
    '1717587639_split_011_split_001.html',  # 11 无人可控 (内容)
    '1717587639_split_012_split_001.html',  # 12 下一颗北极星 (内容)
]

# EPUB 章节目录（从 nav.xhtml 获取的正文章节标题）
CHAPTER_TITLES = {
    1: "01 如坐针毡的华盛顿之行",
    2: "02 逐梦之旅",
    3: "03 鸿沟渐窄",
    4: "04 心智探索",
    5: "05 第一道光",
    6: "06 北极星",
    7: "07 一个假设",
    8: "08 实验验证",
    9: "09 万物以外是什么",
    10: "10 似易实难",
    11: "11 无人可控",
    12: "12 下一颗北极星",
}

def classify_by_file(filename):
    """根据文件名精确判断章节类型"""
    if filename in APPENDIX_FILES:
        return 'appendix'
    
    base = filename.replace('.html', '').replace('.xhtml', '')
    
    # 正文文件模式: split_001 到 split_015 (排除附录)
    # 通过提取数字判断
    nums = re.findall(r'split_(\d+)', base)
    if nums:
        first_num = int(nums[0])
        # 0 = 扉页/献词
        if first_num == 0:
            return 'preface'
        # 1-15 = 正文章节（含致谢、译后记）
        # 16-35 = 赞誉/导读（附录）
        if first_num >= 16:
            return 'appendix'
        # 1-15 且有 _split_000 后缀 = 章节标题页（内容很少）
        if len(nums) > 1 and nums[1] == '000':
            return 'chapter_header'  # 章节标题页
        return 'main'
    
    return 'unknown'

def main():
    epub_path = "我看见的世界 ([美]李飞飞) .epub"
    output_path = "src/data/wo-kanjian-de-shijie.json"
    
    print(f"正在读取: {epub_path}")
    book = epub.read_epub(epub_path)
    
    all_items = []
    for item in book.get_items():
        if item.get_type() == 9:
            raw = item.get_content().decode('utf-8')
            text = clean_html(raw)
            title = get_real_title(raw)
            file_type = classify_by_file(item.get_name())
            all_items.append({
                'file': item.get_name(),
                'title': title,
                'text': text,
                'length': len(text),
                'file_type': file_type
            })
    
    print(f"\n=== 所有文件分类 ===")
    for it in all_items:
        print(f"  [{it['file_type']:16s}] {it['file']} | '{it['title']}' | {it['length']} chars")
    
    # 构建章节列表：过滤有效内容（>50字符），排除纯目录文件
    # chapter_header（章节标题页）：内容少，单独合并入下一章或跳过
    chapters = []
    main_chapter_idx = 0
    
    for it in all_items:
        if it['length'] <= 50:
            continue
        if it['file'] == 'nav.xhtml':
            continue
        if it['file_type'] == 'chapter_header':
            print(f"  [跳过章节标题页] {it['file']}: '{it['title']}' ({it['length']} chars)")
            continue
        
        ftype = it['file_type']
        
        # 确定最终显示标题
        if ftype == 'main':
            main_chapter_idx += 1
            final_title = CHAPTER_TITLES.get(main_chapter_idx, it['title'] or f"第{main_chapter_idx}章")
            chapter_type = 'main'
        elif ftype == 'preface':
            final_title = it['title'] or "前言"
            chapter_type = 'preface'
        elif ftype == 'appendix':
            final_title = it['title'] or "附录"
            chapter_type = 'appendix'
        else:
            final_title = it['title'] or it['file']
            chapter_type = 'appendix'
        
        chapters.append({
            "title": final_title,
            "type": chapter_type,
            "content": it['text']
        })
    
    # 修正：致谢、译后记 应为 appendix（不是 main）
    for ch in chapters:
        if ch['title'] in ['致谢', '译后记']:
            ch['type'] = 'appendix'
    
    # 构建完整 JSON
    result = {
        "id": "wo-kanjian-de-shijie",
        "title": "我看见的世界",
        "author": "李飞飞",
        "chapters": chapters
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 已保存到: {output_path}")
    print(f"   总章节数: {len(chapters)}")
    
    type_count = {}
    for ch in chapters:
        t = ch['type']
        type_count[t] = type_count.get(t, 0) + 1
    print(f"   类型分布: {type_count}")
    
    print(f"\n=== 最终章节列表 ===")
    for i, ch in enumerate(chapters):
        print(f"[{i+1:02d}] [{ch['type']:10s}] '{ch['title']}' ({len(ch['content'])} chars)")

if __name__ == '__main__':
    main()
