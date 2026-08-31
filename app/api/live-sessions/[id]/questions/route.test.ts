import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
import { GET } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const request = () => new Request(`https://test.local/api/live-sessions/${id}/questions`);
const params = (paramId = id) => Promise.resolve({ id: paramId });
let auth: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, rpc });
});

describe('GET /api/live-sessions/[id]/questions', () => {
  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(request(), { params: params() })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects a malformed id', async () => {
    expect((await GET(request(), { params: params('not-a-uuid') })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns 404 when the RPC reports FORBIDDEN (not owned or does not exist)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'FORBIDDEN' } });
    expect((await GET(request(), { params: params() })).status).toBe(404);
  });
  it('returns the mapped question list, including hidden ones', async () => {
    rpc.mockResolvedValue({
      data: [
        { id: 'q1', text: 'public one', lens: 'clarify', visibility: 'public', upvotes: 2, created_at: '2026-01-01T00:00:00Z' },
        { id: 'q2', text: 'hidden one', lens: 'bridge', visibility: 'author_only', upvotes: 0, created_at: '2026-01-02T00:00:00Z' },
      ],
      error: null,
    });
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: 'q1', text: 'public one', lens: 'clarify', visibility: 'public', upvotes: 2, createdAt: '2026-01-01T00:00:00Z', isMine: undefined },
      { id: 'q2', text: 'hidden one', lens: 'bridge', visibility: 'author_only', upvotes: 0, createdAt: '2026-01-02T00:00:00Z', isMine: undefined },
    ]);
    expect(rpc).toHaveBeenCalledWith('get_live_questions_for_owner', { p_session_id: id });
  });
  it('does not leak an unrelated database error as a 200', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'connection reset' } });
    expect((await GET(request(), { params: params() })).status).toBe(500);
  });
});
