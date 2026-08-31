import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient, broadcastLiveUpdate } = vi.hoisted(() => ({ getServerClient: vi.fn(), broadcastLiveUpdate: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => { void callback(); },
}));
import { POST } from './route';

const body = { kind: 'applause' };
const request = (payload: unknown = body, origin = 'https://test.local') =>
  new Request('https://test.local/api/live/482910/react', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const params = (code = '482910') => Promise.resolve({ code });
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ rpc });
});

describe('POST /api/live/[code]/react', () => {
  it('rejects cross-origin requests', async () => {
    expect((await POST(request(body, 'https://other.local'), { params: params() })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects a malformed code and an unknown reaction kind', async () => {
    expect((await POST(request(), { params: params('abc') })).status).toBe(400);
    expect((await POST(request({ kind: 'confetti' }), { params: params() })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns 404 for an unknown code', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await POST(request(), { params: params() })).status).toBe(404);
  });
  it('rejects when the session is not open', async () => {
    rpc.mockResolvedValue({ data: [{ session_id: 's1', status: 'paused' }], error: null });
    expect((await POST(request(), { params: params() })).status).toBe(409);
    expect(broadcastLiveUpdate).not.toHaveBeenCalled();
  });
  it('broadcasts the reaction and returns 204 with no body', async () => {
    rpc.mockResolvedValue({ data: [{ session_id: 's1', status: 'open' }], error: null });
    const response = await POST(request(), { params: params() });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(broadcastLiveUpdate).toHaveBeenCalledWith('s1', 'reaction:sent', { kind: 'applause' });
  });
  it('does not leak database errors as a success', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await POST(request(), { params: params() })).status).toBe(500);
  });
  it('reports a failed broadcast so the UI can show a retry message', async () => {
    rpc.mockResolvedValue({ data: [{ session_id: 's1', status: 'open' }], error: null });
    broadcastLiveUpdate.mockRejectedValue(new Error('offline'));
    expect((await POST(request(), { params: params() })).status).toBe(500);
  });
});

it('echoes the client event ID for deduplication', async () => {
  rpc.mockResolvedValue({data:[{session_id:'s1',status:'open'}],error:null});
  const reactionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  expect((await POST(request({...body,reactionId}),{params:params()})).status).toBe(204);
  expect(broadcastLiveUpdate).toHaveBeenCalledWith('s1','reaction:sent',{...body,reactionId});
});
