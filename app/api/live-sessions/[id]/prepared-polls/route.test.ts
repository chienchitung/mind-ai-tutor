import { beforeEach, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClient }));
import { GET, PUT } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const pollId = '11111111-1111-4111-8111-111111111111';
const poll = { id: pollId, question: 'IF 的第一個參數是？', options: ['條件', '結果'] };
const url = `https://test.local/api/live-sessions/${id}/prepared-polls`;
const put = (body: unknown, origin = 'https://test.local') =>
  new Request(url, { method: 'PUT', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const params = (paramId = id) => Promise.resolve({ id: paramId });

let chain: Record<string, ReturnType<typeof vi.fn>>;
let auth: ReturnType<typeof vi.fn>;
beforeEach(() => {
  chain = Object.fromEntries(['select', 'update', 'eq', 'maybeSingle'].map((name) => [name, vi.fn()]));
  for (const name of ['select', 'update', 'eq']) chain[name].mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue({ data: { prepared_polls: [poll, { broken: true }] }, error: null });
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, from: vi.fn(() => chain) });
});

it("returns the teacher's own prepared polls, skipping malformed entries", async () => {
  const response = await GET(new Request(url), { params: params() });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ polls: [poll] });
  expect(chain.eq).toHaveBeenCalledWith('user_id', 'owner');
});

it('says the feature is not ready before its migration runs', async () => {
  chain.maybeSingle.mockResolvedValue({ data: null, error: { code: '42703' } });
  expect((await GET(new Request(url), { params: params() })).status).toBe(503);
});

it('rejects signed-out, cross-origin and invalid writes', async () => {
  expect((await PUT(put({ polls: [poll] }, 'https://other.local'), { params: params() })).status).toBe(403);
  expect((await PUT(put({ polls: [{ ...poll, options: ['只有一個'] }] }), { params: params() })).status).toBe(400);
  expect((await PUT(put({ polls: Array.from({ length: 31 }, () => poll) }), { params: params() })).status).toBe(400);
  auth.mockResolvedValue({ data: { user: null }, error: null });
  expect((await PUT(put({ polls: [poll] }), { params: params() })).status).toBe(401);
  expect(chain.update).not.toHaveBeenCalled();
});

it('saves the list on the owner\'s session only', async () => {
  chain.maybeSingle.mockResolvedValue({ data: { prepared_polls: [{ ...poll, used: true }] }, error: null });
  const response = await PUT(put({ polls: [{ ...poll, used: true }] }), { params: params() });
  expect(response.status).toBe(200);
  expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ prepared_polls: [{ ...poll, used: true }] }));
  expect(chain.eq).toHaveBeenCalledWith('user_id', 'owner');
  expect(await response.json()).toEqual({ polls: [{ ...poll, used: true }] });

  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  expect((await PUT(put({ polls: [] }), { params: params() })).status).toBe(404);
});
