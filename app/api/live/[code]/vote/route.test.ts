import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient, broadcastLiveUpdate } = vi.hoisted(() => ({ getServerClient: vi.fn(), broadcastLiveUpdate: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate }));
// next/server's real after() throws outside an actual request context, which
// this direct handler-call test style never has. Run the callback inline -
// the route always wraps it in its own .catch(), so this stays safe even
// when broadcastLiveUpdate rejects.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => { void callback(); },
}));
import { POST } from './route';

const participantId = '11111111-1111-4111-8111-111111111111';
const body = { participantId, optionIndex: 1 };
const request = (payload: unknown = body, origin = 'https://test.local') =>
  new Request('https://test.local/api/live/482910/vote', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const params = (code = '482910') => Promise.resolve({ code });
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ rpc });
});

const lookupRow = { session_id: 's1', active_poll_id: 'p1' };

describe('POST /api/live/[code]/vote', () => {
  it('rejects cross-origin requests', async () => {
    expect((await POST(request(body, 'https://other.local'), { params: params() })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects a malformed code and invalid input', async () => {
    expect((await POST(request(), { params: params('abc') })).status).toBe(400);
    expect((await POST(request({ participantId, optionIndex: -1 }), { params: params() })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns 404 when the code has no active poll', async () => {
    rpc.mockResolvedValue({ data: [{ session_id: 's1', active_poll_id: null }], error: null });
    expect((await POST(request(), { params: params() })).status).toBe(404);
  });
  it('casts the vote against the resolved poll and broadcasts the fresh tally', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null })
      .mockResolvedValueOnce({ data: [{ vote_counts: [1, 2], vote_total: 3 }], error: null });
    const response = await POST(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ voteCounts: [1, 2], voteTotal: 3 });
    expect(rpc).toHaveBeenNthCalledWith(2, 'cast_live_poll_vote', { p_poll_id: 'p1', p_participant_id: participantId, p_option_index: 1 });
    expect(broadcastLiveUpdate).toHaveBeenCalledWith('s1', 'poll:tally', { pollId: 'p1', voteCounts: [1, 2], voteTotal: 3 });
  });
  it('maps a known business error to 409', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'SESSION_NOT_OPEN' } });
    const response = await POST(request(), { params: params() });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'SESSION_NOT_OPEN' });
  });
  it('maps an unknown database error to 500', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'connection reset' } });
    expect((await POST(request(), { params: params() })).status).toBe(500);
  });
  it('still succeeds if the broadcast fails', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null })
      .mockResolvedValueOnce({ data: [{ vote_counts: [1, 2], vote_total: 3 }], error: null });
    broadcastLiveUpdate.mockRejectedValue(new Error('offline'));
    expect((await POST(request(), { params: params() })).status).toBe(200);
  });
});
