import { beforeEach, expect, it, vi } from 'vitest';

const { getServerClient, broadcastLiveUpdate } = vi.hoisted(() => ({ getServerClient: vi.fn(), broadcastLiveUpdate: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => { void callback(); },
}));
import { DELETE } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const request = (scope = 'all', origin = 'https://test.local') =>
  new Request(`https://test.local/api/live-sessions/${id}/activity?scope=${scope}`, { method: 'DELETE', headers: { origin } });
const params = (paramId = id) => Promise.resolve({ id: paramId });
let auth: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, rpc });
});

it('rejects cross-origin, bad input and signed-out callers before touching the database', async () => {
  expect((await DELETE(request('all', 'https://other.local'), { params: params() })).status).toBe(403);
  expect((await DELETE(request('all'), { params: params('nope') })).status).toBe(400);
  expect((await DELETE(request('votes'), { params: params() })).status).toBe(400);
  auth.mockResolvedValue({ data: { user: null }, error: null });
  expect((await DELETE(request('all'), { params: params() })).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});

it('clears the asked-for data and tells every screen', async () => {
  const response = await DELETE(request('questions'), { params: params() });
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('clear_live_session_activity', { p_session_id: id, p_questions: true, p_pulse: false });
  expect(broadcastLiveUpdate).toHaveBeenCalledWith(id, 'activity:cleared', { questions: true, pulse: false });
  expect(broadcastLiveUpdate).toHaveBeenCalledWith(id, 'presentation:changed', {});

  broadcastLiveUpdate.mockClear();
  await DELETE(request('pulse'), { params: params() });
  expect(rpc).toHaveBeenLastCalledWith('clear_live_session_activity', { p_session_id: id, p_questions: false, p_pulse: true });
  expect(broadcastLiveUpdate.mock.calls.map(([, event]) => event)).toEqual(['activity:cleared']);
});

it("answers 404 for someone else's session", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'FORBIDDEN' } });
  expect((await DELETE(request('all'), { params: params() })).status).toBe(404);
  expect(broadcastLiveUpdate).not.toHaveBeenCalled();
});
