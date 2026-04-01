/**
 * Embedding 封装
 * 使用阿里云 DashScope text-embedding-v3（国内可直接访问）
 */

const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';

async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY 环境变量未设置');
  }

  const res = await fetch(DASHSCOPE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-v3',
      input: { texts },
      parameters: { dimension: 1024 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DashScope Embedding API 错误: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    output?: { embeddings?: Array<{ embedding: number[] }> };
  };

  const embeddings = data?.output?.embeddings;
  if (!embeddings || embeddings.length === 0) {
    throw new Error(`DashScope Embedding 返回格式异常: ${JSON.stringify(data)}`);
  }

  return embeddings.map(e => e.embedding);
}

export function getEmbeddings() {
  return {
    embedQuery: async (text: string): Promise<number[]> => {
      const results = await embedTexts([text]);
      return results[0];
    },
    embedDocuments: async (texts: string[]): Promise<number[][]> => {
      // DashScope 单次最多 25 条，分批处理
      const batchSize = 25;
      const all: number[][] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const vecs = await embedTexts(batch);
        all.push(...vecs);
      }
      return all;
    },
  };
}
