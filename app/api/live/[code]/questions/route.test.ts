import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient, broadcastLiveUpdate } = vi.hoisted(() => ({ getServerClient: vi.fn(), broadcastLiveUpdate: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => { void callback(); },
}));
import { GET, POST } from './route';

const participantId = '11111111-1111-4111-8111-111111111111';
const params = (code = '482910') => Promise.resolve({ code });
const getRequest = (query = '') => new Request(`https://test.local/api/live/482910/questions${query}`);
const postBody = { participantId, text: 'SUMIF 跟 SUMIFS 差在哪?', lens: 'clarify' };
const postRequest = (payload: unknown = postBody, origin = 'https://test.local') =>
  new Request('https://test.local/api/live/482910/questions', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ rpc });
});

const lookupRow = { session_id: 's1' };

describe('GET /api/live/[code]/questions', () => {
  it('rejects a malformed code and a malformed participantId without calling the database', async () => {
    expect((await GET(getRequest(), { params: params('abc') })).status).toBe(400);
    expect((await GET(getRequest('?participantId=not-a-uuid'), { params: params() })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns 404 for an unknown code', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect((await GET(getRequest(), { params: params() })).status).toBe(404);
  });
  it('returns the mapped question list, passing the participant id through', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({
      data: [{ id: 'q1', text: 'SUMIF?', lens: 'clarify', visibility: 'public', upvotes: 2, created_at: '2026-01-01T00:00:00Z', is_mine: true }],
      error: null,
    });
    const response = await GET(getRequest(`?participantId=${participantId}`), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: 'q1', text: 'SUMIF?', lens: 'clarify', visibility: 'public', upvotes: 2, createdAt: '2026-01-01T00:00:00Z', isMine: true },
    ]);
    expect(rpc).toHaveBeenNthCalledWith(2, 'get_live_questions', { p_session_id: 's1', p_participant_id: participantId });
  });
  it('does not leak database errors as a 200', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect((await GET(getRequest(), { params: params() })).status).toBe(500);
  });
});

describe('POST /api/live/[code]/questions', () => {
  it('rejects cross-origin requests', async () => {
    expect((await POST(postRequest(postBody, 'https://other.local'), { params: params() })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects a malformed code and invalid input', async () => {
    expect((await POST(postRequest(), { params: params('abc') })).status).toBe(400);
    expect((await POST(postRequest({ participantId, text: '', lens: 'clarify' }), { params: params() })).status).toBe(400);
    expect((await POST(postRequest({ participantId, text: 'ok', lens: 'nope' }), { params: params() })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns 404 for an unknown code', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect((await POST(postRequest(), { params: params() })).status).toBe(404);
  });
  it('submits the question and broadcasts it', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({
      data: [{ id: 'q1', text: postBody.text, lens: 'clarify', visibility: 'public', upvotes: 0, created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    });
    const response = await POST(postRequest(), { params: params() });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: 'q1', text: postBody.text, lens: 'clarify', visibility: 'public', upvotes: 0, createdAt: '2026-01-01T00:00:00Z', isMine: undefined,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'submit_live_question', {
      p_session_id: 's1', p_participant_id: participantId, p_text: postBody.text, p_lens: 'clarify',
    });
    expect(broadcastLiveUpdate).toHaveBeenCalledWith('s1', 'question:new', expect.objectContaining({ id: 'q1' }));
  });
  it('maps a known business error to 409', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({ data: null, error: { message: 'SESSION_NOT_OPEN' } });
    const response = await POST(postRequest(), { params: params() });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'SESSION_NOT_OPEN' });
  });
  it('maps an unknown database error to 500', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({ data: null, error: { message: 'connection reset' } });
    expect((await POST(postRequest(), { params: params() })).status).toBe(500);
  });
  it('still succeeds if the broadcast fails', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({
      data: [{ id: 'q1', text: postBody.text, lens: 'clarify', visibility: 'public', upvotes: 0, created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    });
    broadcastLiveUpdate.mockRejectedValue(new Error('offline'));
    expect((await POST(postRequest(), { params: params() })).status).toBe(201);
  });
});
