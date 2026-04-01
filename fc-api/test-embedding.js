const API_KEY = '0d16bc4d84964b77ae00025d895edc1a.BoXIIenTle5BbzO8';

const res = await fetch('https://open.bigmodel.cn/api/paas/v4/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'embedding-3',
    input: '李飞飞是谁',
  }),
});
const data = await res.json();
console.log('status:', res.status);
console.log('向量维度:', data?.data?.[0]?.embedding?.length ?? '无');
console.log('响应:', JSON.stringify(data).slice(0, 200));
