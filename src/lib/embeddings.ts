/**
 * Embedding 封装
 * 使用 HuggingFace Transformers 本地模型（免费）
 * 模型：BAAI/bge-small-zh-v1.5（中文优化）
 */

import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';

let _embeddings: HuggingFaceTransformersEmbeddings | null = null;

export function getEmbeddings(): HuggingFaceTransformersEmbeddings {
  if (!_embeddings) {
    _embeddings = new HuggingFaceTransformersEmbeddings({
      model: 'Xenova/bge-small-zh-v1.5',
    });
  }
  return _embeddings;
}
