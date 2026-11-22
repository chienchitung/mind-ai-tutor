import { beforeEach, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClient }));
import { GET } from './route';

const request = () => new Request('https://test.local/api/live/482910/timer');
const params = (code = '482910') => Promise.resolve({ code });
const rpc = vi.fn();
beforeEach(() => { rpc.mockReset(); getServerClient.mockResolvedValue({ rpc }); });

it('returns the class timer by code with the server time', async () => {
  const timer = { durationSeconds: 300, remainingSeconds: 300, endsAt: null };
  rpc.mockResolvedValue({ data: timer, error: null });
  const body = await (await GET(request(), { params: params() })).json();
  expect(body.timer).toEqual(timer);
  expect(typeof body.serverNow).toBe('number');
  expect(rpc).toHaveBeenCalledWith('get_live_timer', { p_code: '482910' });
});

it('shows no timer before the migration, and rejects a malformed code', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
  expect((await (await GET(request(), { params: params() })).json()).timer).toBeNull();
  expect((await GET(request(), { params: params('abc') })).status).toBe(400);
});

it('reports a database failure as an error, so a student keeps the countdown on screen', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'statement timeout' } });
  expect((await GET(request(), { params: params() })).status).toBe(500);
});
