import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => {
  process.env.GEMINI_API_KEY = 'test-only';
  return { generateContent: vi.fn() };
});
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));
import { POST } from './route';

let requestNumber = 0;
const makeRequest = (
  body: unknown = { message: '請給我一個提示' },
  options: { origin?: string; ip?: string; contentLength?: string; userAgent?: string } = {},
) => {
  requestNumber += 1;
  return new Request('https://game.test/games/api/chat', {
    method: 'POST',
    headers: {
      origin: options.origin ?? 'https://game.test',
      'content-type': 'application/json',
      'user-agent': options.userAgent ?? `test-${requestNumber}`,
      'x-forwarded-for': options.ip ?? `192.0.2.${requestNumber}`,
      ...(options.contentLength ? { 'content-length': options.contentLength } : {}),
    },
    body: JSON.stringify(body),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GEMINI_API_KEY', 'test-only');
  generateContent.mockResolvedValue({ text: '提示' });
});
afterEach(() => vi.unstubAllEnvs());

describe('Game AI chat guardrails', () => {
  it('rejects cross-origin and origin-less requests', async () => {
    expect((await POST(makeRequest(undefined, { origin: 'https://attacker.test' }))).status).toBe(403);
    const noOrigin = new Request('https://game.test/games/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });
    expect((await POST(noOrigin)).status).toBe(403);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('fails closed without the server API key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect((await POST(makeRequest())).status).toBe(503);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('bounds body, messages, history, tutor prompt and image types', async () => {
    expect((await POST(makeRequest({}, { contentLength: '3000001' }))).status).toBe(413);
    expect((await POST(makeRequest({ message: 'x'.repeat(4001) }))).status).toBe(400);
    expect((await POST(makeRequest({ message: 'ok', context: { context: Array(9).fill({ content: 'x', isUser: true }), lessonInfo: '' } }))).status).toBe(400);
    expect((await POST(makeRequest({ message: 'ok', context: { context: [], lessonInfo: '', tutorPrompt: 'x'.repeat(16001) } }))).status).toBe(400);
    expect((await POST(makeRequest({ message: '', image: 'data:image/svg+xml;base64,PHN2Zz4=' }))).status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('rate limits repeated calls by client fingerprint', async () => {
    const responses = [];
    for (let index = 0; index < 13; index += 1) {
      responses.push(await POST(makeRequest(undefined, { ip: '198.51.100.42', userAgent: 'same-client' })));
    }
    expect(responses.slice(0, 12).every(response => response.status === 200)).toBe(true);
    expect(responses[12].status).toBe(429);
    expect(generateContent).toHaveBeenCalledTimes(12);
  });

  it('passes a validated request and prevents caching', async () => {
    const response = await POST(makeRequest({
      message: ' 提示 ',
      context: { context: [{ content: '我試過 SUM', isUser: true }], lessonInfo: '加總', gameTitle: '試算表' },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.any(String),
      contents: expect.stringContaining('學生：提示'),
    }));
  });
});
