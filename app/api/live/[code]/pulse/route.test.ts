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
const body = { participantId, value: 4 };
const request = (payload: unknown = body, origin = 'https://test.local') =>
  new Request('https://test.local/api/live/482910/pulse', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const params = (code = '482910') => Promise.resolve({ code });
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ rpc });
});

const lookupRow = { session_id: 's1' };

describe('POST /api/live/[code]/pulse', () => {
  it('rejects cross-origin requests', async () => {
    expect((await POST(request(body, 'https://other.local'), { params: params() })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects a malformed code and an out-of-range value', async () => {
    expect((await POST(request(), { params: params('abc') })).status).toBe(400);
    expect((await POST(request({ participantId, value: 9 }), { params: params() })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns 404 for an unknown code', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await POST(request(), { params: params() })).status).toBe(404);
  });
  it('sets the pulse against the resolved session and broadcasts the summary', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null })
      .mockResolvedValueOnce({ data: [{ pulse_counts: [0, 0, 0, 1, 0], pulse_total: 1, pulse_average: '4.00' }], error: null });
    const response = await POST(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pulseCounts: [0, 0, 0, 1, 0], pulseTotal: 1, pulseAverage: '4.00' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'set_live_pulse', { p_session_id: 's1', p_participant_id: participantId, p_value: 4 });
    expect(broadcastLiveUpdate).toHaveBeenCalledWith('s1', 'pulse:update', { pulseCounts: [0, 0, 0, 1, 0], pulseTotal: 1, pulseAverage: '4.00' });
  });
  it('maps a known business error to 409', async () => {
    rpc.mockResolvedValueOnce({ data: [lookupRow], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'SESSION_NOT_OPEN' } });
    expect((await POST(request(), { params: params() })).status).toBe(409);
  });
});
