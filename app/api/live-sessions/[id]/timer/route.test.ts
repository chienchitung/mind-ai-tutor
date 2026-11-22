import { beforeEach, expect, it, vi } from 'vitest';

const { getServerClient, broadcastLiveUpdate } = vi.hoisted(() => ({ getServerClient: vi.fn(), broadcastLiveUpdate: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => { void callback(); },
}));
import { GET, POST } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const url = `https://test.local/api/live-sessions/${id}/timer`;
const post = (body: unknown, origin = 'https://test.local') =>
  new Request(url, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const params = (paramId = id) => Promise.resolve({ id: paramId });
let chain: Record<string, ReturnType<typeof vi.fn>>;
let auth: ReturnType<typeof vi.fn>;
const now = Date.parse('2026-11-22T10:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers({ now, toFake: ['Date'] });
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  chain = Object.fromEntries(['select', 'update', 'eq', 'maybeSingle'].map((name) => [name, vi.fn()]));
  for (const name of ['select', 'update', 'eq']) chain[name].mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue({ data: { id, timer: { durationSeconds: 300, remainingSeconds: 300, endsAt: null } }, error: null });
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, from: vi.fn(() => chain) });
});

it('starts the timer against the server clock, on the owner\'s session only, and tells every screen', async () => {
  const response = await POST(post({ action: 'start' }), { params: params() });
  expect(response.status).toBe(200);
  const timer = { durationSeconds: 300, remainingSeconds: 300, endsAt: '2026-11-22T10:05:00.000Z' };
  expect(await response.json()).toEqual({ timer, serverNow: now });
  expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ timer }));
  expect(chain.eq).toHaveBeenCalledWith('user_id', 'owner');
  expect(broadcastLiveUpdate).toHaveBeenCalledWith(id, 'timer:update', { timer, serverNow: now });
  vi.useRealTimers();
});

it('rejects cross-origin, malformed, unknown and signed-out requests before writing', async () => {
  expect((await POST(post({ action: 'start' }, 'https://other.local'), { params: params() })).status).toBe(403);
  expect((await POST(post({ action: 'start' }), { params: params('nope') })).status).toBe(400);
  expect((await POST(post({ action: 'explode' }), { params: params() })).status).toBe(400);
  expect((await POST(post({ action: 'set', seconds: 0 }), { params: params() })).status).toBe(400);
  auth.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(post({ action: 'start' }), { params: params() })).status).toBe(401);
  expect(chain.update).not.toHaveBeenCalled();
  vi.useRealTimers();
});

it("answers 404 for someone else's session and 503 before the migration", async () => {
  chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  expect((await POST(post({ action: 'start' }), { params: params() })).status).toBe(404);
  chain.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: '42703' } });
  expect((await GET(new Request(url), { params: params() })).status).toBe(503);
  expect(broadcastLiveUpdate).not.toHaveBeenCalled();
  vi.useRealTimers();
});
