import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient, broadcastLiveUpdate } = vi.hoisted(() => ({ getServerClient: vi.fn(), broadcastLiveUpdate: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => { void callback(); },
}));
import { PATCH } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const qid = '22222222-2222-4222-8222-222222222222';
const body = { visibility: 'author_only' };
const request = (payload: unknown = body, origin = 'https://test.local') =>
  new Request(`https://test.local/api/live-sessions/${id}/questions/${qid}`, { method: 'PATCH', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const params = (paramId = id, paramQid = qid) => Promise.resolve({ id: paramId, qid: paramQid });
let auth: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, rpc });
});

describe('PATCH /api/live-sessions/[id]/questions/[qid]', () => {
  it('rejects cross-origin requests', async () => {
    expect((await PATCH(request(body, 'https://other.local'), { params: params() })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await PATCH(request(), { params: params() })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects a malformed session id, malformed question id, and invalid visibility', async () => {
    expect((await PATCH(request(), { params: params('not-a-uuid') })).status).toBe(400);
    expect((await PATCH(request(), { params: params(id, 'not-a-uuid') })).status).toBe(400);
    expect((await PATCH(request({ visibility: 'secret' }), { params: params() })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('moderates the question and broadcasts it', async () => {
    rpc.mockResolvedValue({ data: [{ id: qid, visibility: 'author_only' }], error: null });
    const response = await PATCH(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ questionId: qid, visibility: 'author_only' });
    expect(rpc).toHaveBeenCalledWith('moderate_live_question', { p_question_id: qid, p_visibility: 'author_only' });
    expect(broadcastLiveUpdate).toHaveBeenCalledWith(id, 'question:moderated', { questionId: qid, visibility: 'author_only' });
  });
  it('returns 404 when the RPC reports FORBIDDEN (not owned or does not exist)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'FORBIDDEN' } });
    expect((await PATCH(request(), { params: params() })).status).toBe(404);
  });
  it('does not leak an unrelated database error as a 200', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'connection reset' } });
    expect((await PATCH(request(), { params: params() })).status).toBe(500);
  });
  it('still succeeds if the broadcast fails', async () => {
    rpc.mockResolvedValue({ data: [{ id: qid, visibility: 'author_only' }], error: null });
    broadcastLiveUpdate.mockRejectedValue(new Error('offline'));
    expect((await PATCH(request(), { params: params() })).status).toBe(200);
  });
});
