import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
import { GET } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const request = () => new Request(`https://test.local/api/quizzes/${id}/attempts`);
const params = (paramId = id) => Promise.resolve({ id: paramId });
let chain: Record<string, ReturnType<typeof vi.fn>>;
let auth: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  chain = Object.fromEntries(['select', 'eq', 'order', 'limit'].map(name => [name, vi.fn()]));
  for (const name of ['select', 'eq', 'order']) chain[name].mockReturnValue(chain);
  chain.limit.mockResolvedValue({ data: [], error: null });
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  from = vi.fn().mockReturnValue(chain);
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, from });
});

describe('GET /api/quizzes/[id]/attempts', () => {
  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(request(), { params: params() })).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects a malformed id', async () => {
    expect((await GET(request(), { params: params('not-a-uuid') })).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it('scopes attempts to this quiz and relies on RLS for ownership', async () => {
    const rows = [{ id: 'a1', student_name: 'Alex', score: 3, total: 5, submitted_at: '2026-01-01T00:00:00Z' }];
    chain.limit.mockResolvedValue({ data: rows, error: null });
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(rows);
    expect(from).toHaveBeenCalledWith('ai_quiz_attempts');
    expect(chain.eq).toHaveBeenCalledWith('quiz_id', id);
  });
  it('does not report success for a failed database read', async () => {
    chain.limit.mockResolvedValue({ data: null, error: { code: '42501' } });
    expect((await GET(request(), { params: params() })).status).toBe(500);
  });
});
