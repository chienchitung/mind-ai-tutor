import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
const { generateContent, rpc, isAdminRequest } = vi.hoisted(() => {
  process.env.GEMINI_API_KEY = 'test-only';
  return { generateContent: vi.fn(), rpc: vi.fn(), isAdminRequest: vi.fn() };
});
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('../../../lib/supabase-server', () => ({ isAdminRequest }));
import { POST } from './route';

let requestNumber = 0;
const makeRequest = (
  body: unknown = { message: '請給我一個提示', deviceId: DEVICE_ID },
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
  rpc.mockResolvedValue({ data: 'OK', error: null });
  isAdminRequest.mockResolvedValue(false);
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
    expect((await POST(makeRequest({ message: 'x'.repeat(4001), deviceId: DEVICE_ID }))).status).toBe(400);
    expect((await POST(makeRequest({ message: 'ok', deviceId: DEVICE_ID, context: { context: Array(9).fill({ content: 'x', isUser: true }), lessonInfo: '' } }))).status).toBe(400);
    expect((await POST(makeRequest({ message: 'ok', deviceId: DEVICE_ID, context: { context: [], lessonInfo: '', tutorPrompt: 'x'.repeat(16001) } }))).status).toBe(400);
    expect((await POST(makeRequest({ message: '', deviceId: DEVICE_ID, image: 'data:image/svg+xml;base64,PHN2Zz4=' }))).status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('rejects a missing or malformed device id', async () => {
    expect((await POST(makeRequest({ message: 'ok' }))).status).toBe(400);
    expect((await POST(makeRequest({ message: 'ok', deviceId: 'not-a-uuid' }))).status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
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
      deviceId: DEVICE_ID,
      context: { context: [{ content: '我試過 SUM', isUser: true }], lessonInfo: '加總', gameTitle: '試算表' },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(rpc).toHaveBeenCalledWith('claim_game_chat_message', { p_device_id: DEVICE_ID });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.any(String),
      contents: expect.stringContaining('學生：提示'),
    }));
  });

  it('blocks generation once the device has hit its daily cap, without ever calling Gemini', async () => {
    rpc.mockResolvedValue({ data: 'DAILY_LIMIT', error: null });
    const response = await POST(makeRequest());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'DAILY_LIMIT' });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('fails closed when the device quota migration is missing, rather than generating for free', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'missing function' } });
    const response = await POST(makeRequest());
    expect(response.status).toBe(503);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('skips the device daily cap entirely for an admin testing in the same browser', async () => {
    isAdminRequest.mockResolvedValue(true);
    rpc.mockResolvedValue({ data: 'DAILY_LIMIT', error: null }); // would otherwise block
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
