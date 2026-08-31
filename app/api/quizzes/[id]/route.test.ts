import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
import { DELETE, PATCH } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const request = (origin = 'https://test.local') => new Request(`https://test.local/api/quizzes/${id}`, { method: 'DELETE', headers: { origin } });
const patchRequest = (body: unknown, origin = 'https://test.local') => new Request(`https://test.local/api/quizzes/${id}`, { method: 'PATCH', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const params = (paramId = id) => Promise.resolve({ id: paramId });
let chain: Record<string, ReturnType<typeof vi.fn>>;
let auth: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  chain = Object.fromEntries(['delete', 'eq', 'update', 'select', 'maybeSingle'].map(name => [name, vi.fn()]));
  for (const name of ['delete', 'eq', 'update', 'select']) chain[name].mockReturnValue(chain);
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  from = vi.fn().mockReturnValue(chain);
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, from });
});

describe('DELETE /api/quizzes/[id]', () => {
  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    Object.assign(chain, { then: undefined });
    expect((await DELETE(request(), { params: params() })).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests', async () => {
    expect((await DELETE(request('https://other.local'), { params: params() })).status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects a malformed id', async () => {
    expect((await DELETE(request(), { params: params('not-a-uuid') })).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it('scopes the delete to the verified owner', async () => {
    chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce({ error: null, count: 1 });
    const response = await DELETE(request(), { params: params() });
    expect(response.status).toBe(204);
    expect(from).toHaveBeenCalledWith('ai_quizzes');
    expect(chain.eq).toHaveBeenCalledWith('id', id);
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'owner');
  });
  it('returns 404 when nothing owned by this user matched', async () => {
    chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce({ error: null, count: 0 });
    expect((await DELETE(request(), { params: params() })).status).toBe(404);
  });
  it('does not report success for a failed database delete', async () => {
    chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce({ error: { code: '42501' }, count: null });
    expect((await DELETE(request(), { params: params() })).status).toBe(500);
  });
});

describe('PATCH /api/quizzes/[id]', () => {
  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await PATCH(patchRequest({ isPublic: true }), { params: params() })).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests', async () => {
    expect((await PATCH(patchRequest({ isPublic: true }, 'https://other.local'), { params: params() })).status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects a malformed id and an invalid payload', async () => {
    expect((await PATCH(patchRequest({ isPublic: true }), { params: params('not-a-uuid') })).status).toBe(400);
    expect((await PATCH(patchRequest({ isPublic: 'yes' }), { params: params() })).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it('scopes the update to the verified owner and returns the new state', async () => {
    chain.maybeSingle.mockResolvedValue({ data: { id, is_public: true }, error: null });
    const response = await PATCH(patchRequest({ isPublic: true }), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id, is_public: true });
    expect(from).toHaveBeenCalledWith('ai_quizzes');
    expect(chain.update).toHaveBeenCalledWith({ is_public: true });
    expect(chain.eq).toHaveBeenCalledWith('id', id);
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'owner');
  });
  it('returns 404 when nothing owned by this user matched', async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await PATCH(patchRequest({ isPublic: true }), { params: params() })).status).toBe(404);
  });
  it('does not report success for a failed database update', async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: { code: '42501' } });
    expect((await PATCH(patchRequest({ isPublic: true }), { params: params() })).status).toBe(500);
  });
});
