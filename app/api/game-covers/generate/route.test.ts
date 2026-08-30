import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const { getServerClient, generateCoverBackground } = vi.hoisted(() => ({ getServerClient: vi.fn(), generateCoverBackground: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
vi.mock('@/lib/ai-game-cover-server', () => ({ generateCoverBackground }));
import { POST } from './route';
const body = { title: 'Excel', brief: 'Learn SUM', topics: [], style: 'minimal', consent: true, requestId: '2ff6060b-785d-409a-938f-fb7e69d261d6' };
const makeRequest = (value: unknown = body, origin = 'https://test.local') => new Request('https://test.local/api/game-covers/generate', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
let auth: ReturnType<typeof vi.fn>, rpc: ReturnType<typeof vi.fn>, profile: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('AI_GAME_COVERS_ENABLED', 'true'); vi.stubEnv('GEMINI_API_KEY', 'test-only');
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'verified' } }, error: null });
  rpc = vi.fn().mockResolvedValue({ data: 'OK', error: null });
  profile = vi.fn().mockResolvedValue({ data: { role: 'teacher' }, error: null });
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: profile }; chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, rpc, from: vi.fn().mockReturnValue(chain) });
  generateCoverBackground.mockResolvedValue({ data: 'aW1hZ2U=', mimeType: 'image/png' });
});
afterEach(() => vi.unstubAllEnvs());
describe('AI cover API guardrails', () => {
  it('requires same-origin requests before authentication or billing', async () => {
    expect((await POST(makeRequest(body, 'https://other.local'))).status).toBe(403);
    expect((await POST(makeRequest(body, ''))).status).toBe(403);
    expect(getServerClient).not.toHaveBeenCalled();
    expect(generateCoverBackground).not.toHaveBeenCalled();
  });
  it('requires a verified session', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(makeRequest())).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(generateCoverBackground).not.toHaveBeenCalled();
  });
  it.each(['AI_GAME_COVERS_ENABLED', 'GEMINI_API_KEY'])('fails closed when %s is absent', async variable => {
    vi.stubEnv(variable, '');
    const response = await POST(makeRequest()); expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'AI_NOT_CONFIGURED' });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects extra photo data, missing consent and invalid JSON without charging', async () => {
    expect((await POST(makeRequest({ ...body, photo: 'data' }))).status).toBe(400);
    expect((await POST(makeRequest({ ...body, consent: false }))).status).toBe(400);
    const malformed = new Request('https://test.local/api/game-covers/generate', { method: 'POST', headers: { origin: 'https://test.local' }, body: '{' });
    expect((await POST(malformed)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('bounds the actual streamed body, not just Content-Length', async () => {
    expect((await POST(makeRequest({ ...body, brief: 'x'.repeat(20001) }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(['student', null])('rejects role %s before billing', async role => {
    profile.mockResolvedValue({ data: role ? { role } : null, error: null });
    expect((await POST(makeRequest())).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled(); expect(generateCoverBackground).not.toHaveBeenCalled();
  });
  it.each([['DAILY_LIMIT', 429], ['COOLDOWN', 429], ['DUPLICATE', 409], ['unexpected', 503]])('blocks %s before provider call', async (code, status) => {
    rpc.mockResolvedValue({ data: code, error: null });
    expect((await POST(makeRequest())).status).toBe(status);
    expect(generateCoverBackground).not.toHaveBeenCalled();
  });
  it('never bypasses a missing quota migration', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    expect((await POST(makeRequest())).status).toBe(503);
    expect(generateCoverBackground).not.toHaveBeenCalled();
  });
  it('claims one quota and returns one private image without storage/database cover writes', async () => {
    const response = await POST(makeRequest()); expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('claim_game_cover_generation', { p_request_id: body.requestId });
    expect(generateCoverBackground).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({ data: 'aW1hZ2U=', mimeType: 'image/png' });
  });
  it('does not retry provider failures or leak their details', async () => {
    generateCoverBackground.mockRejectedValue(new Error('private API key error'));
    const response = await POST(makeRequest()); expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'AI_FAILED' });
    expect(generateCoverBackground).toHaveBeenCalledTimes(1);
  });
});
