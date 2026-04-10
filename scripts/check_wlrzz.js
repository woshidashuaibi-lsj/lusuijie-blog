const fs = require('fs');
const content = fs.readFileSync('public/wlrzz/index.html', 'utf-8');

// 统计人物ID数量（只匹配CHARACTERS数组里的id字段）
const charIds = [...content.matchAll(/\{\s*\n\s*id: '([A-Z_]+)'/g)].map(m => m[1]);
console.log('CHARACTERS中人物ID数量:', charIds.length);
console.log('人物列表:', charIds.join(', '));

// 统计题目数量
const qCount = [...content.matchAll(/\/\* ── Q\d+/g)].length;
console.log('\nQUESTIONS题目数量:', qCount);

// 检查Landing文案
const landingMatch = content.match(/<p class="hero-sub">([\s\S]*?)<\/p>/);
if (landingMatch) console.log('\nLanding文案:', landingMatch[1].replace(/<br>/g, ' | '));

// 检查meta description
const metaMatch = content.match(/meta name="description" content="([^"]+)"/);
if (metaMatch) console.log('Meta描述:', metaMatch[1]);

// 检查QUESTIONS中引用的人物ID
const questionIds = new Set([...content.matchAll(/w: \{([^}]+)\}/g)].flatMap(m =>
  [...m[1].matchAll(/([A-Z_]+):\d+/g)].map(n => n[1])
));
console.log('\nQUESTIONS中引用的人物ID数量:', questionIds.size);

const charSet = new Set(charIds);
const missing = [...questionIds].filter(id => !charSet.has(id));
if (missing.length > 0) {
  console.error('QUESTIONS中引用了CHARACTERS里不存在的ID:', missing.join(', '));
} else {
  console.log('所有QUESTIONS引用的ID都在CHARACTERS中存在 ✅');
}

const notInQuestions = [...charSet].filter(id => !questionIds.has(id));
if (notInQuestions.length > 0) {
  console.warn('\n⚠️ 以下人物在QUESTIONS中未被引用:', notInQuestions.join(', '));
} else {
  console.log('所有CHARACTERS人物在QUESTIONS中都有引用 ✅');
}
