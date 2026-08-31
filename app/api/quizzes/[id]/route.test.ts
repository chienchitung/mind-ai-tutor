import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
import { DELETE } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const request = (origin = 'https://test.local') => new Request(`https://test.local/api/quizzes/${id}`, { method: 'DELETE', headers: { origin } });
const params = (paramId = id) => Promise.resolve({ id: paramId });
let chain: Record<string, ReturnType<typeof vi.fn>>;
let auth: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  chain = Object.fromEntries(['delete', 'eq'].map(name => [name, vi.fn()]));
  chain.delete.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
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
