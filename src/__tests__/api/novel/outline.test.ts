/**
 * 大纲生成 API 单元测试
 * POST /api/novel/outline
 *
 * 测试策略：
 * - Mock callLLM，验证 handler 的参数验证和响应处理逻辑
 * - 验证边界条件：空灵感、超长灵感、无效 LLM 响应
 * - 验证 JSON 解析：处理带 markdown 代码块的响应
 */

import type { NextApiRequest, NextApiResponse } from 'next';

// 动态 mock，让 jest.mock 工作
jest.mock('@/lib/llm', () => ({
  callLLM: jest.fn(),
}));

import handler from '@/pages/api/novel/outline';
import { callLLM } from '@/lib/llm';

const mockCallLLM = callLLM as jest.MockedFunction<typeof callLLM>;

// ── 测试工具 ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>, method = 'POST'): NextApiRequest {
  return {
    method,
    body,
    query: {},
    headers: {},
  } as unknown as NextApiRequest;
}

function makeResponse(): { res: NextApiResponse; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as NextApiResponse;
  // 让 res.json 也可以直接被调用（有时 handler 直接调用 res.json）
  Object.assign(res, { json });
  return { res, status, json };
}

const validOutlineJSON = JSON.stringify({
  genre: '玄幻',
  theme: '成长与牺牲',
  logline: '普通少年踏上修炼之旅，为保护家园对抗魔族',
  setting: '东玄大陆，灵气充盈的修炼世界',
  conflict: '主角与魔族势力的殊死较量，内心挣扎与成长',
  arc: '起：意外获得传承；承：艰难修炼历程；转：发现黑暗秘密；合：决战大魔头',
  estimatedChapters: 100,
});

// ── 测试 ─────────────────────────────────────────────────────────────────────

describe('POST /api/novel/outline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP 方法验证', () => {
    test('GET 请求返回 405', async () => {
      const req = makeRequest({}, 'GET');
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(405);
      expect(json).toHaveBeenCalledWith({ message: 'Method Not Allowed' });
    });

    test('DELETE 请求返回 405', async () => {
      const req = makeRequest({}, 'DELETE');
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(405);
    });
  });

  describe('请求体验证', () => {
    test('缺少 idea 字段返回 400', async () => {
      const req = makeRequest({});
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    test('idea 为空字符串返回 400', async () => {
      const req = makeRequest({ idea: '' });
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(400);
    });

    test('idea 为仅空白字符返回 400', async () => {
      const req = makeRequest({ idea: '   \n\t  ' });
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(400);
    });

    test('idea 超过 2000 字返回 400', async () => {
      const req = makeRequest({ idea: 'A'.repeat(2001) });
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('2000') }));
    });

    test('idea 恰好 2000 字是允许的', async () => {
      mockCallLLM.mockResolvedValue(validOutlineJSON);
      const req = makeRequest({ idea: 'A'.repeat(2000) });
      const { res, status } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
    });
  });

  describe('成功响应', () => {
    test('正常 LLM 响应返回 200 和 OutlineData', async () => {
      mockCallLLM.mockResolvedValue(validOutlineJSON);

      const req = makeRequest({ idea: '一个少年修炼成仙的故事' });
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
      const result = json.mock.calls[0][0];
      expect(result.genre).toBe('玄幻');
      expect(result.theme).toBe('成长与牺牲');
      expect(result.estimatedChapters).toBe(100);
      // idea 字段应该来自请求，而非 LLM
      expect(result.idea).toBe('一个少年修炼成仙的故事');
    });

    test('处理带 markdown 代码块的 LLM 响应', async () => {
      const withMarkdown = '```json\n' + validOutlineJSON + '\n```';
      mockCallLLM.mockResolvedValue(withMarkdown);

      const req = makeRequest({ idea: '修炼故事' });
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
      const result = json.mock.calls[0][0];
      expect(result.genre).toBe('玄幻');
    });

    test('处理带普通代码块的 LLM 响应', async () => {
      const withCodeBlock = '```\n' + validOutlineJSON + '\n```';
      mockCallLLM.mockResolvedValue(withCodeBlock);

      const req = makeRequest({ idea: '修炼故事' });
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
    });

    test('输出中 idea 字段来自请求而非 LLM', async () => {
      mockCallLLM.mockResolvedValue(validOutlineJSON);

      const userIdea = '我想写一个关于星际战争的故事，主角是一名孤独的宇宙飞船驾驶员';
      const req = makeRequest({ idea: userIdea });
      const { res, json } = makeResponse();

      await handler(req, res);

      const result = json.mock.calls[0][0];
      expect(result.idea).toBe(userIdea);
    });
  });

  describe('错误处理', () => {
    test('LLM 返回无效 JSON 时返回 500', async () => {
      mockCallLLM.mockResolvedValue('这不是有效的JSON{{{');

      const req = makeRequest({ idea: '修炼故事' });
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    test('LLM 返回缺少必填字段的 JSON 时返回 500', async () => {
      const incomplete = JSON.stringify({ genre: '玄幻' }); // 缺少其他字段
      mockCallLLM.mockResolvedValue(incomplete);

      const req = makeRequest({ idea: '修炼故事' });
      const { res, status } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(500);
    });

    test('callLLM 抛出异常时返回 500', async () => {
      mockCallLLM.mockRejectedValue(new Error('API 调用超时'));

      const req = makeRequest({ idea: '修炼故事' });
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'API 调用超时' }));
    });

    test('callLLM 抛出非 Error 异常时返回通用错误信息', async () => {
      mockCallLLM.mockRejectedValue('网络错误');

      const req = makeRequest({ idea: '修炼故事' });
      const { res, status, json } = makeResponse();

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });
  });

  describe('estimatedChapters 类型转换', () => {
    test('字符串形式的章节数被转换为数字', async () => {
      const withStringChapters = JSON.stringify({
        ...JSON.parse(validOutlineJSON),
        estimatedChapters: '80', // 字符串
      });
      mockCallLLM.mockResolvedValue(withStringChapters);

      const req = makeRequest({ idea: '修炼故事' });
      const { res, json } = makeResponse();

      await handler(req, res);

      const result = json.mock.calls[0][0];
      expect(typeof result.estimatedChapters).toBe('number');
      expect(result.estimatedChapters).toBe(80);
    });

    test('无效章节数默认为 30', async () => {
      const withInvalidChapters = JSON.stringify({
        ...JSON.parse(validOutlineJSON),
        estimatedChapters: 'not-a-number',
      });
      mockCallLLM.mockResolvedValue(withInvalidChapters);

      const req = makeRequest({ idea: '修炼故事' });
      const { res, json } = makeResponse();

      await handler(req, res);

      const result = json.mock.calls[0][0];
      expect(result.estimatedChapters).toBe(30);
    });
  });
});
