require('dotenv').config();
const fs = require('fs');
const path = require('path');

const apiKey = process.env.MINIMAX_API_KEY;
const persona = fs.readFileSync(path.join(__dirname, 'data/personas/dao-gui-yi-xian.txt'), 'utf8');

console.log('persona 长度:', persona.length);

fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
  body: JSON.stringify({
    model: 'MiniMax-M2.7',
    messages: [
      { role: 'system', content: persona },
      { role: 'user', content: '你从幻觉里带回来过什么东西？' }
    ],
    stream: true,
    max_tokens: 1024
  })
}).then(r => r.text()).then(t => {
  console.log('=== 完整响应 ===');
  // 逐行打印看清楚结构
  t.split('\n').filter(l => l.trim()).forEach(l => console.log(l));
}).catch(e => console.error(e));
