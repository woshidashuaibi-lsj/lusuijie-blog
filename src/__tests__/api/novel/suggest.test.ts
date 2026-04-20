/**
 * AI 修改建议 API 单元测试
 * POST /api/novel/suggest
 *
 * 测试重点：
 * - JSON 解析逻辑（含 markdown 代码块处理）
 * - 参数验证
 * - 错误处理
 */

import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/llm', () => ({
  callLLM: jest.fn(),
}));

import handler from '@/pages/api/novel/suggest';
import { callLLM } from '@/lib/llm';

const mockCallLLM = callLLM as jest.MockedFunction<typeof callLLM>;

function makeRequest(body: Record<string, unknown>, method = 'POST'): NextApiRequest {
  return { method, body, query: {}, headers: {} } as unknown as NextApiRequest;
}

function makeResponse() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as NextApiResponse;
  Object.assign(res, { json });
  return { res, status, json };
}

const validSuggestionsJSON = JSON.stringify([
  {
    dimension: '节奏感',
    issue: '第二段过于冗长，描述了太多无关细节',
    suggestion: '建议删除主角观察周围环境的三段描写，直接进入核心冲突',
  },
  {
    dimension: '悬念钩子',
    issue: '结尾过于平淡，读者缺乏阅读下一章的动力',
    suggestion: '在结尾加入一个意外发现或危机预警，制造悬念',
  },
]);

describe('POST /api/novel/suggest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP 方法验证', () => {
    test('非 POST 请求返回 405', async () => {
      const req = makeRequest({}, 'GET');
      const { res, status, json } = makeResponse();
      await handler(req, res);
      expect(status).toHaveBeenCalledWith(405);
      expect(json).toHaveBeenCalledWith({ message: 'Method Not Allowed' });
    });
  });

  describe('参数验证', () => {
    test('缺少 content 返回 400', async () => {
      const req = makeRequest({ chapterNumber: 1 });
      const { res, status } = makeResponse();
      await handler(req, res);
      expect(status).toHaveBeenCalledWith(400);
    });

    test('content 为空字符串返回 400', async () => {
      const req = makeRequest({ content: '', chapterNumber: 1 });
      const { res, status } = makeResponse();
      await handler(req, res);
      expect(status).toHaveBeenCalledWith(400);
    });

    test('content 为仅空白字符返回 400', async () => {
      const req = makeRequest({ content: '  \n  ', chapterNumber: 1 });
      const { res, status } = makeResponse();
      await handler(req, res);
      expect(status).toHaveBeenCalledWith(400);
    });
  });

  describe('成功响应', () => {
    test('返回建议数组', async () => {
      mockCallLLM.mockResolvedValue(validSuggestionsJSON);

      const req = makeRequest({ content: '章节内容...', chapterNumber: 3 });
      const { res, status, json } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
      const result = json.mock.calls[0][0];
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBe(2);
      expect(result.suggestions[0].dimension).toBe('节奏感');
      expect(result.suggestions[1].dimension).toBe('悬念钩子');
    });

    test('处理带 markdown 代码块的 LLM 响应', async () => {
      const withMarkdown = '```json\n' + validSuggestionsJSON + '\n```';
      mockCallLLM.mockResolvedValue(withMarkdown);

      const req = makeRequest({ content: '章节内容', chapterNumber: 1 });
      const { res, status, json } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
      const result = json.mock.calls[0][0];
      expect(result.suggestions).toBeInstanceOf(Array);
    });

    test('处理 LLM 响应中前缀文字 + JSON 数组的情况', async () => {
      const withPrefix = '以下是我的修改建议：\n\n' + validSuggestionsJSON + '\n\n希望对你有帮助';
      mockCallLLM.mockResolvedValue(withPrefix);

      const req = makeRequest({ content: '章节内容', chapterNumber: 1 });
      const { res, status, json } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
      const result = json.mock.calls[0][0];
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBe(2);
    });

    test('带 worldContext 时成功调用', async () => {
      mockCallLLM.mockResolvedValue(validSuggestionsJSON);

      const req = makeRequest({
        content: '章节内容',
        worldContext: '这是一个修炼世界',
        chapterNumber: 5,
      });
      const { res, status } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
      // worldContext 应该被包含在用户提示词中
      const callArgs = mockCallLLM.mock.calls[0][0];
      const userMessage = callArgs.find((m: { role: string }) => m.role === 'user');
      expect(userMessage?.content).toContain('这是一个修炼世界');
    });

    test('不带 worldContext 时也能成功', async () => {
      mockCallLLM.mockResolvedValue(validSuggestionsJSON);

      const req = makeRequest({ content: '章节内容', chapterNumber: 1 });
      const { res, status } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
    });
  });

  describe('内容截断', () => {
    test('超过 6000 字的内容被截断后传给 LLM', async () => {
      mockCallLLM.mockResolvedValue(validSuggestionsJSON);
      const longContent = 'A'.repeat(8000);
      const req = makeRequest({ content: longContent, chapterNumber: 1 });
      const { res } = makeResponse();
      await handler(req, res);

      const callArgs = mockCallLLM.mock.calls[0][0];
      const userMessage = callArgs.find((m: { role: string }) => m.role === 'user');
      // 6000字截断 + 其他文字，总长度不应超过原来的 8000
      expect(userMessage?.content.length).toBeLessThan(8000);
    });
  });

  describe('错误处理', () => {
    test('LLM 返回无效 JSON 时返回 500', async () => {
      mockCallLLM.mockResolvedValue('这不是 JSON');

      const req = makeRequest({ content: '章节内容', chapterNumber: 1 });
      const { res, status, json } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    test('LLM 返回 JSON 对象而非数组时返回 500', async () => {
      mockCallLLM.mockResolvedValue(JSON.stringify({ dimension: '节奏感', issue: '有问题' }));

      const req = makeRequest({ content: '章节内容', chapterNumber: 1 });
      const { res, status } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(500);
    });

    test('callLLM 抛出异常时返回 500', async () => {
      mockCallLLM.mockRejectedValue(new Error('网络超时'));

      const req = makeRequest({ content: '章节内容', chapterNumber: 1 });
      const { res, status, json } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: '网络超时' }));
    });
  });
});
