/**
 * Step 组件公共工具函数
 *
 * 小说创作 API 已迁移到 fc-api 云服务，通过 NEXT_PUBLIC_API_BASE 访问。
 * 本地开发时 NEXT_PUBLIC_API_BASE 为空字符串，走本地 Next.js API Routes（需同时启 dev server）。
 * 线上构建时 NEXT_PUBLIC_API_BASE 由 GitHub Actions 注入云服务器地址。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

/**
 * 在向导步骤中调用 AI（非流式）
 * 通过 /api/novel/chat 通用接口
 */
export async function callLLM(
  userPrompt: string,
  systemPrompt?: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/novel/chat/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: systemPrompt || '你是一位专业的小说创作助手，帮助用户规划和创作长篇小说。',
      userPrompt,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '请求失败' }));
    throw new Error(err.message || 'AI 调用失败');
  }

  const data = await res.json();
  return data.content as string;
}

/**
 * 从 AI 返回的文本中提取 JSON 对象或数组字符串，并做必要的清理
 *
 * 处理以下常见问题：
 * 1. markdown 代码块包裹：```json ... ``` 或 ``` ... ```
 * 2. 中文全角引号（' ' " "）→ 标准 ASCII 引号
 * 3. 提取最外层的 { } 或 [ ] 块（忽略前后多余文字）
 *
 * 返回清理后的 JSON 字符串，调用方再 JSON.parse
 */
export function extractJSON(text: string, type: 'object' | 'array' = 'object'): string {
  let s = text.trim();

  // 1. 去掉 markdown 代码块
  const codeBlockMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    s = codeBlockMatch[1].trim();
  }

  // 2. 替换中文全角引号为标准引号（AI 常见错误）
  s = s
    .replace(/[\u2018\u2019]/g, "'")   // ' '  → '
    .replace(/[\u201c\u201d]/g, '"');   // " "  → "

  // 3. 提取最外层 JSON 结构
  if (type === 'array') {
    const m = s.match(/\[[\s\S]*\]/);
    if (m) s = m[0];
  } else {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) s = m[0];
  }

  return s;
}
