/**
 * GET /api/characters/[bookSlug]
 * 获取指定书籍的人物数据列表
 * 输出：{ characters: Character[] }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';
import type { CharactersData } from '@/types/character';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { bookSlug } = req.query;

  if (!bookSlug || typeof bookSlug !== 'string') {
    return res.status(400).json({ message: 'bookSlug 参数无效' });
  }

  // 安全校验：只允许字母、数字、连字符
  if (!/^[a-z0-9-]+$/.test(bookSlug)) {
    return res.status(400).json({ message: 'bookSlug 格式不合法' });
  }

  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'characters', `${bookSlug}.json`);

    if (!fs.existsSync(filePath)) {
      // 文件不存在时返回空数组，而非报错
      return res.status(200).json({ characters: [] });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data: CharactersData = JSON.parse(raw);

    return res.status(200).json({ characters: data.characters || [] });
  } catch (error) {
    console.error(`[characters API] 读取 ${bookSlug} 人物数据失败:`, error);
    return res.status(500).json({ message: '读取人物数据失败' });
  }
}
