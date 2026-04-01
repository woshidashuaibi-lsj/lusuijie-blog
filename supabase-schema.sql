-- RAG 向量库表结构
-- 在 Supabase Dashboard -> SQL Editor 中执行此 SQL

-- 创建存储文档的表
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding REAL[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以加速相似度搜索
CREATE INDEX IF NOT EXISTS idx_rag_documents_collection ON rag_documents(collection);
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding ON rag_documents USING ivfflat (embedding real_cosine_ops);

-- 启用 Row Level Security (可选，测试环境可以先关闭)
-- ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;

-- 如果是测试环境，可以关闭 RLS
DROP POLICY IF EXISTS "Allow all reads" ON rag_documents;
DROP POLICY IF EXISTS "Allow all inserts" ON rag_documents;
DROP POLICY IF EXISTS "Allow all deletes" ON rag_documents;

CREATE POLICY "Allow all operations" ON rag_documents
  FOR ALL USING (true) WITH CHECK (true);
