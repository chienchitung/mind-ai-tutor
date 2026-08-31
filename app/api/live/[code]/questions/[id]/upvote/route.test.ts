import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient, broadcastLiveUpdate } = vi.hoisted(() => ({ getServerClient: vi.fn(), broadcastLiveUpdate: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => { void callback(); },
}));
import { POST } from './route';

const participantId = '11111111-1111-4111-8111-111111111111';
const questionId = '22222222-2222-4222-8222-222222222222';
const body = { participantId };
const request = (payload: unknown = body, origin = 'https://test.local') =>
  new Request(`https://test.local/api/live/482910/questions/${questionId}/upvote`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const params = (code = '482910', id = questionId) => Promise.resolve({ code, id });
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ rpc });
});

const lookupRow = { session_id: 's1' };

describe('POST /api/live/[code]/questions/[id]/upvote', () => {
  it('rejects cross-origin requests', async () => {
    expect((await POST(request(body, 'https://other.local'), { params: params() })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects a malformed code, malformed question id, and invalid input', async () => {
    expect((await POST(request(), { params: params('abc') })).status).toBe(400);
    expect((await POST(request(), { params: params('482910', 'not-a-uuid') })).status).toBe(400);
    expect((await POST(request({ participantId: 'nope' }), { params: params() })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns 404 for an unknown code', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect((await POST(request(), { params: params() })).status).toBe(404);
  });
  it('upvotes and broadcasts the fresh count', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({ data: [{ upvotes: 3 }], error: null });
    const response = await POST(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ questionId, upvotes: 3 });
    expect(rpc).toHaveBeenNthCalledWith(2, 'upvote_live_question', { p_question_id: questionId, p_participant_id: participantId });
    expect(broadcastLiveUpdate).toHaveBeenCalledWith('s1', 'question:upvote', { questionId, upvotes: 3 });
  });
  it('maps QUESTION_NOT_FOUND to 404', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({ data: null, error: { message: 'QUESTION_NOT_FOUND' } });
    expect((await POST(request(), { params: params() })).status).toBe(404);
  });
  it('maps SESSION_NOT_OPEN to 409', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({ data: null, error: { message: 'SESSION_NOT_OPEN' } });
    expect((await POST(request(), { params: params() })).status).toBe(409);
  });
  it('maps an unknown database error to 500', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({ data: null, error: { message: 'connection reset' } });
    expect((await POST(request(), { params: params() })).status).toBe(500);
  });
  it('still succeeds if the broadcast fails', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null }).mockResolvedValueOnce({ data: [{ upvotes: 3 }], error: null });
    broadcastLiveUpdate.mockRejectedValue(new Error('offline'));
    expect((await POST(request(), { params: params() })).status).toBe(200);
  });
});
