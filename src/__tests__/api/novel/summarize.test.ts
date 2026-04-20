/**
 * 章节摘要生成 API 单元测试
 * POST /api/novel/summarize
 *
 * 测试重点：
 * - 超长摘要的截断逻辑（300汉字限制）
 * - 参数验证
 * - LLM 调用和错误处理
 */

import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/llm', () => ({
  callLLM: jest.fn(),
}));

import handler from '@/pages/api/novel/summarize';
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

// 生成指定数量汉字的字符串
function makeChinese(count: number): string {
  return '好'.repeat(count);
}

describe('POST /api/novel/summarize', () => {
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
      const req = makeRequest({ content: '   ', chapterNumber: 1 });
      const { res, status } = makeResponse();
      await handler(req, res);
      expect(status).toHaveBeenCalledWith(400);
    });
  });

  describe('成功响应', () => {
    test('正常内容返回摘要', async () => {
      const summary = '主角经历了艰难的修炼，最终突破瓶颈，实力大增。';
      mockCallLLM.mockResolvedValue(summary);

      const req = makeRequest({ content: '第一章正文内容...', chapterNumber: 1 });
      const { res, status, json } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ summary: summary.trim() });
    });

    test('带标题时返回摘要', async () => {
      mockCallLLM.mockResolvedValue('本章摘要内容');
      const req = makeRequest({ content: '章节正文', chapterNumber: 5, title: '天赋觉醒' });
      const { res, status, json } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ summary: '本章摘要内容' });
    });

    test('LLM 返回前后空格时被去除', async () => {
      mockCallLLM.mockResolvedValue('  摘要内容   ');
      const req = makeRequest({ content: '正文', chapterNumber: 1 });
      const { res, json } = makeResponse();
      await handler(req, res);

      const result = json.mock.calls[0][0];
      expect(result.summary).toBe('摘要内容');
    });
  });

  describe('超长摘要截断（300汉字限制）', () => {
    test('恰好 300 汉字的摘要不被截断', async () => {
      const exactly300 = makeChinese(300);
      mockCallLLM.mockResolvedValue(exactly300);

      const req = makeRequest({ content: '正文', chapterNumber: 1 });
      const { res, json } = makeResponse();
      await handler(req, res);

      const result = json.mock.calls[0][0];
      // 恰好 300 不应该被截断（不应该有省略号）
      expect(result.summary).not.toContain('…');
      expect(result.summary.length).toBe(300);
    });

    test('301 汉字的摘要被截断为 300 汉字加省略号', async () => {
      const tooLong = makeChinese(301);
      mockCallLLM.mockResolvedValue(tooLong);

      const req = makeRequest({ content: '正文', chapterNumber: 1 });
      const { res, json } = makeResponse();
      await handler(req, res);

      const result = json.mock.calls[0][0];
      expect(result.summary).toContain('…');
      // 截断后汉字数应该 <= 300
      const chineseCount = (result.summary.match(/[\u4e00-\u9fff]/g) || []).length;
      expect(chineseCount).toBeLessThanOrEqual(300);
    });

    test('500 汉字的摘要被截断', async () => {
      const tooLong = makeChinese(500);
      mockCallLLM.mockResolvedValue(tooLong);

      const req = makeRequest({ content: '正文', chapterNumber: 1 });
      const { res, json } = makeResponse();
      await handler(req, res);

      const result = json.mock.calls[0][0];
      const chineseCount = (result.summary.match(/[\u4e00-\u9fff]/g) || []).length;
      expect(chineseCount).toBeLessThanOrEqual(300);
    });

    test('混合中英文摘要：只计算汉字数量', async () => {
      // 100 个英文字符 + 200 个汉字 = 总共 300 汉字（不超限）
      const mixed = 'Hello World '.repeat(10) + makeChinese(200);
      mockCallLLM.mockResolvedValue(mixed);

      const req = makeRequest({ content: '正文', chapterNumber: 1 });
      const { res, json } = makeResponse();
      await handler(req, res);

      const result = json.mock.calls[0][0];
      // 200 汉字不超限，不应该截断
      expect(result.summary).not.toContain('…');
    });

    test('超长混合摘要：英文不计入汉字计数', async () => {
      // 1000 个英文字符 + 350 个汉字
      const mixed = 'A'.repeat(1000) + makeChinese(350);
      mockCallLLM.mockResolvedValue(mixed);

      const req = makeRequest({ content: '正文', chapterNumber: 1 });
      const { res, json } = makeResponse();
      await handler(req, res);

      const result = json.mock.calls[0][0];
      // 350 汉字超限，应该截断
      const chineseCount = (result.summary.match(/[\u4e00-\u9fff]/g) || []).length;
      expect(chineseCount).toBeLessThanOrEqual(300);
      expect(result.summary).toContain('…');
    });
  });

  describe('长内容截断传递给 LLM', () => {
    test('超过 8000 字的内容被截断后传给 LLM', async () => {
      mockCallLLM.mockResolvedValue('摘要');
      const longContent = 'A'.repeat(10000);
      const req = makeRequest({ content: longContent, chapterNumber: 1 });
      const { res } = makeResponse();
      await handler(req, res);

      // callLLM 被调用时，用户消息中的内容不超过 8000 字
      expect(mockCallLLM).toHaveBeenCalledTimes(1);
      const callArgs = mockCallLLM.mock.calls[0][0];
      const userMessage = callArgs.find((m: { role: string }) => m.role === 'user');
      expect(userMessage?.content.length).toBeLessThan(10000);
    });
  });

  describe('错误处理', () => {
    test('callLLM 抛出异常时返回 500', async () => {
      mockCallLLM.mockRejectedValue(new Error('LLM 服务不可用'));

      const req = makeRequest({ content: '正文', chapterNumber: 1 });
      const { res, status, json } = makeResponse();
      await handler(req, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'LLM 服务不可用' }));
    });
  });
});
