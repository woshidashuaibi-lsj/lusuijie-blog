/**
 * 构建向量库脚本
 * 读取《我看见的世界》章节数据，分割文本，存储到 Chroma 向量库
 *
 * 用法：npx ts-node scripts/build-vectorstore.ts
 * 前提：需要先启动 Chroma 服务：docker run -p 8000:8000 chromadb/chroma
 */

import * as fs from 'fs';
import * as path from 'path';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';
import { Document } from '@langchain/core/documents';

const DATA_FILE = path.join(__dirname, '../src/data/wo-kanjian-de-shijie.json');
const COLLECTION_NAME = 'wo-kanjian-de-shijie';
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

interface Chapter {
  title: string;
  content: string;
}

interface BookData {
  chapters: Chapter[];
}

async function buildVectorStore() {
  console.log('📖 读取书籍数据...');
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const bookData: BookData = JSON.parse(raw);
  const { chapters } = bookData;
  console.log(`  共 ${chapters.length} 章节`);

  // 文本分割器
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: ['\n\n', '\n', '。', '！', '？', '；', ' '],
  });

  console.log('✂️  分割文本...');
  const docs: Document[] = [];
  for (const chapter of chapters) {
    const chunks = await splitter.splitText(chapter.content);
    for (const chunk of chunks) {
      docs.push(
        new Document({
          pageContent: chunk,
          metadata: {
            chapterTitle: chapter.title,
          },
        })
      );
    }
  }
  console.log(`  共生成 ${docs.length} 个文本块`);

  console.log('🤖 初始化 Embedding 模型（首次运行会下载模型，请稍候）...');
  const embeddings = new HuggingFaceTransformersEmbeddings({
    model: 'Xenova/bge-small-zh-v1.5',
  });

  console.log(`🗄️  存储到 Chroma（${CHROMA_URL}）...`);
  await Chroma.fromDocuments(docs, embeddings, {
    collectionName: COLLECTION_NAME,
    url: CHROMA_URL,
    collectionMetadata: {
      'hnsw:space': 'cosine',
    },
  });

  console.log('✅ 向量库构建完成！');
  console.log(`   集合名称：${COLLECTION_NAME}`);
  console.log(`   文档数量：${docs.length}`);
}

buildVectorStore().catch((err) => {
  console.error('❌ 构建失败：', err);
  process.exit(1);
});
