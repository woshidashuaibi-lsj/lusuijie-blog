/**
 * 格式化书籍 JSON 数据中的段落
 * 将中文句末标点（。！？）后跟空格的位置，替换为段落分隔符 \n\n
 * 这样 BookReader 组件的 split('\n\n') 就能正确渲染分段，
 * 同时 RAG 向量库切割时也能得到更清晰的语义段落
 *
 * 处理以下文件：
 *   - src/data/books.json（BookReader 页面实际读取的来源）
 *   - src/data/wo-kanjian-de-shijie.json（备用/RAG 参考）
 *   - fc-api/data/wo-kanjian-de-shijie.json（RAG 向量库构建来源）
 */

const fs = require('fs');
const path = require('path');

function formatContent(text) {
  // 规则：中文句末标点 + 空格 + 非空白字符 → 替换为 \n\n
  // 保留：英文单词之间的空格（如 "Pins and Needles"）
  return text
    // 句号、感叹号、问号后的段落分隔
    .replace(/([。！？])(\s+)(?=[\u4e00-\u9fa5A-Z"「『（【])/g, '$1\n\n')
    // 省略号后的段落分隔
    .replace(/(……)(\s+)(?=[\u4e00-\u9fa5"「『])/g, '$1\n\n')
    // 右引号/右书名号后的段落分隔
    .replace(/([」』"】）])(\s+)(?=[\u4e00-\u9fa5"「『（【A-Z])/g, '$1\n\n');
}

function processChaptersFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('文件不存在，跳过:', filePath);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let changedChapters = 0;
  let totalParas = 0;

  data.chapters = data.chapters.map(ch => {
    const before = ch.content;
    const after = formatContent(ch.content);
    if (before !== after) changedChapters++;
    const paraCount = after.split('\n\n').filter(p => p.trim()).length;
    totalParas += paraCount;
    return { ...ch, content: after };
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  const relPath = path.relative(path.join(__dirname, '..'), filePath);
  console.log(`✅ ${relPath}`);
  console.log(`   - 处理章节数: ${changedChapters} / ${data.chapters.length}`);
  console.log(`   - 总段落数: ${totalParas}`);

  const c = data.chapters[1];
  if (c) {
    const paras = c.content.split('\n\n').filter(p => p.trim());
    console.log(`   - 章节「${c.title}」共 ${paras.length} 段`);
    paras.slice(0, 2).forEach((p, i) => {
      console.log(`     [${i + 1}] ${p.slice(0, 60)}...`);
    });
  }
  console.log('');
}

function processBooksJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('文件不存在，跳过:', filePath);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let totalChanged = 0;
  let totalParas = 0;

  data.books = data.books.map(book => {
    let bookChanged = 0;
    const chapters = book.chapters.map(ch => {
      const before = ch.content;
      const after = formatContent(ch.content);
      if (before !== after) bookChanged++;
      const paraCount = after.split('\n\n').filter(p => p.trim()).length;
      totalParas += paraCount;
      return { ...ch, content: after };
    });
    totalChanged += bookChanged;
    return { ...book, chapters };
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  const relPath = path.relative(path.join(__dirname, '..'), filePath);
  console.log(`✅ ${relPath}`);
  console.log(`   - 处理章节数: ${totalChanged}`);
  console.log(`   - 总段落数: ${totalParas}`);

  // 预览第一本书第2章效果
  const c = data.books[0]?.chapters[1];
  if (c) {
    const paras = c.content.split('\n\n').filter(p => p.trim());
    console.log(`   - 章节「${c.title}」共 ${paras.length} 段`);
    paras.slice(0, 2).forEach((p, i) => {
      console.log(`     [${i + 1}] ${p.slice(0, 60)}...`);
    });
  }
  console.log('');
}

const root = path.join(__dirname, '..');

// 1. books.json（BookReader 页面实际读取的来源，最关键）
processBooksJson(path.join(root, 'src/data/books.json'));

// 2. wo-kanjian-de-shijie.json（两个副本）
processChaptersFile(path.join(root, 'src/data/wo-kanjian-de-shijie.json'));
processChaptersFile(path.join(root, 'fc-api/data/wo-kanjian-de-shijie.json'));
