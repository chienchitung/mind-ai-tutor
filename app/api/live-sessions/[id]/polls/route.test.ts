import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient, broadcastLiveUpdate } = vi.hoisted(() => ({ getServerClient: vi.fn(), broadcastLiveUpdate: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate }));
import { POST } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const draft = { question: '哪個函數可以查表？', options: ['VLOOKUP', 'SUMIF'] };
const request = (body: unknown = draft, origin = 'https://test.local') =>
  new Request(`https://test.local/api/live-sessions/${id}/polls`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const params = (paramId = id) => Promise.resolve({ id: paramId });

let sessionsChain: Record<string, ReturnType<typeof vi.fn>>;
let pollsChain: Record<string, ReturnType<typeof vi.fn>>;
let auth: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  sessionsChain = Object.fromEntries(['select', 'eq', 'maybeSingle', 'update'].map((name) => [name, vi.fn()]));
  for (const name of ['select', 'eq', 'update']) sessionsChain[name].mockReturnValue(sessionsChain);
  sessionsChain.maybeSingle.mockResolvedValue({ data: { id }, error: null });
  // .eq() is both a chain step (select().eq().eq().maybeSingle()) and the
  // terminal call for the active_poll_id update (update().eq()); make the
  // chain object itself thenable so awaiting it directly resolves too.
  (sessionsChain as unknown as { then: PromiseLike<unknown>['then'] }).then = (resolve) => Promise.resolve({ error: null }).then(resolve as never);

  pollsChain = Object.fromEntries(['insert', 'select', 'single'].map((name) => [name, vi.fn()]));
  for (const name of ['insert', 'select']) pollsChain[name].mockReturnValue(pollsChain);
  pollsChain.single.mockResolvedValue({ data: { id: 'poll-2', question: draft.question, options: draft.options }, error: null });

  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  from = vi.fn((table: string) => (table === 'live_polls' ? pollsChain : sessionsChain));
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, from });
});

describe('POST /api/live-sessions/[id]/polls', () => {
  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request(), { params: params() })).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests', async () => {
    expect((await POST(request(draft, 'https://other.local'), { params: params() })).status).toBe(403);
  });
  it('rejects a malformed id and invalid input', async () => {
    expect((await POST(request(), { params: params('not-a-uuid') })).status).toBe(400);
    expect((await POST(request({ ...draft, options: ['only one'] }), { params: params() })).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it('returns 404 for a session this user does not own', async () => {
    sessionsChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await POST(request(), { params: params() })).status).toBe(404);
    expect(pollsChain.insert).not.toHaveBeenCalled();
  });
  it('opens the new poll as the session active poll and broadcasts it', async () => {
    const response = await POST(request(), { params: params() });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ pollId: 'poll-2', question: draft.question, options: draft.options, voteCounts: [0, 0], voteTotal: 0 });
    expect(pollsChain.insert).toHaveBeenCalledWith(expect.objectContaining({ session_id: id, question: draft.question, options: draft.options }));
    expect(sessionsChain.update).toHaveBeenCalledWith(expect.objectContaining({ active_poll_id: 'poll-2' }));
    expect(broadcastLiveUpdate).toHaveBeenCalledWith(id, 'poll:opened', expect.objectContaining({ pollId: 'poll-2' }));
  });
  it('does not report success for a failed poll insert', async () => {
    pollsChain.single.mockResolvedValue({ data: null, error: { code: '42501' } });
    expect((await POST(request(), { params: params() })).status).toBe(500);
    expect(sessionsChain.update).not.toHaveBeenCalled();
  });
});
