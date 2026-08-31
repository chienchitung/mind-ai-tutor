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
import { GET, PATCH } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const request = (body: unknown = { status: 'paused' }, origin = 'https://test.local') =>
  new Request(`https://test.local/api/live-sessions/${id}`, { method: 'PATCH', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const params = (paramId = id) => Promise.resolve({ id: paramId });
let chain: Record<string, ReturnType<typeof vi.fn>>;
let auth: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  chain = Object.fromEntries(['update', 'eq', 'select', 'maybeSingle'].map((name) => [name, vi.fn()]));
  for (const name of ['update', 'eq', 'select']) chain[name].mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue({ data: { id, status: 'paused' }, error: null });
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  from = vi.fn().mockReturnValue(chain);
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, from });
});

describe('PATCH /api/live-sessions/[id]', () => {
  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await PATCH(request(), { params: params() })).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests', async () => {
    expect((await PATCH(request({ status: 'paused' }, 'https://other.local'), { params: params() })).status).toBe(403);
  });
  it('rejects a malformed id and an invalid status', async () => {
    expect((await PATCH(request(), { params: params('not-a-uuid') })).status).toBe(400);
    expect((await PATCH(request({ status: 'archived' }), { params: params() })).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it('updates the status, scoped to the verified owner, and broadcasts it', async () => {
    const response = await PATCH(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id, status: 'paused' });
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'paused' }));
    expect(chain.eq).toHaveBeenCalledWith('id', id);
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(broadcastLiveUpdate).toHaveBeenCalledWith(id, 'session:status', { status: 'paused' });
  });
  it('returns 404 when nothing owned by this user matched', async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await PATCH(request(), { params: params() })).status).toBe(404);
  });
  it('still succeeds if the broadcast fails', async () => {
    broadcastLiveUpdate.mockRejectedValue(new Error('offline'));
    expect((await PATCH(request(), { params: params() })).status).toBe(200);
  });
});

describe('GET /api/live-sessions/[id]', () => {
  const getRequest = () => new Request(`https://test.local/api/live-sessions/${id}`);
  let sessionsChain: Record<string, ReturnType<typeof vi.fn>>;
  let pollsChain: Record<string, ReturnType<typeof vi.fn>>;
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionsChain = Object.fromEntries(['select', 'eq', 'maybeSingle'].map((name) => [name, vi.fn()]));
    for (const name of ['select', 'eq']) sessionsChain[name].mockReturnValue(sessionsChain);
    sessionsChain.maybeSingle.mockResolvedValue({
      data: { id, title: 'Excel 樞紐分析入門', status: 'open', join_code: '482910', active_poll_id: 'poll-1' }, error: null,
    });
    pollsChain = Object.fromEntries(['select', 'eq', 'maybeSingle'].map((name) => [name, vi.fn()]));
    for (const name of ['select', 'eq']) pollsChain[name].mockReturnValue(pollsChain);
    pollsChain.maybeSingle.mockResolvedValue({ data: { id: 'poll-1', question: 'SUMIF?', options: ['A', 'B'] }, error: null });
    rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ vote_counts: [1, 2], vote_total: 3 }], error: null })
      .mockResolvedValueOnce({ data: [{ pulse_counts: [0, 1, 0, 1, 0], pulse_total: 2, pulse_average: '3.00' }], error: null });
    from = vi.fn((table: string) => (table === 'live_polls' ? pollsChain : sessionsChain));
    getServerClient.mockResolvedValue({ auth: { getUser: auth }, from, rpc });
  });

  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(getRequest(), { params: params() })).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects a malformed id', async () => {
    expect((await GET(getRequest(), { params: params('not-a-uuid') })).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it('returns 404 for a session this user does not own', async () => {
    sessionsChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await GET(getRequest(), { params: params() })).status).toBe(404);
  });
  it('returns the owner state including the join code and current tally/pulse', async () => {
    const response = await GET(getRequest(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sessionId: id, title: 'Excel 樞紐分析入門', status: 'open', joinCode: '482910',
      poll: { pollId: 'poll-1', question: 'SUMIF?', options: ['A', 'B'], voteCounts: [1, 2], voteTotal: 3 },
      pulse: { pulseCounts: [0, 1, 0, 1, 0], pulseTotal: 2, pulseAverage: 3 },
    });
  });
  it('returns a null poll when no poll is active yet', async () => {
    sessionsChain.maybeSingle.mockResolvedValue({
      data: { id, title: 'Excel 樞紐分析入門', status: 'open', join_code: '482910', active_poll_id: null }, error: null,
    });
    rpc.mockReset().mockResolvedValueOnce({ data: [{ pulse_counts: [0, 0, 0, 0, 0], pulse_total: 0, pulse_average: null }], error: null });
    const response = await GET(getRequest(), { params: params() });
    expect((await response.json()).poll).toBeNull();
  });
});
