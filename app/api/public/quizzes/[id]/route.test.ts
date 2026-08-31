import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
import { GET } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const request = () => new Request(`https://test.local/api/public/quizzes/${id}`);
const params = (paramId = id) => Promise.resolve({ id: paramId });
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ rpc });
});

describe('GET /api/public/quizzes/[id]', () => {
  it('rejects a malformed id without calling the database', async () => {
    expect((await GET(request(), { params: params('not-a-uuid') })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns the sanitized quiz for a shared id', async () => {
    const quiz = { id, title: 'Excel basics', questions: [{ id: 'q1', questionText: 'Q', options: [] }] };
    rpc.mockResolvedValue({ data: [quiz], error: null });
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(quiz);
    expect(rpc).toHaveBeenCalledWith('get_public_quiz', { p_quiz_id: id });
  });
  it('returns 404 for an unshared or nonexistent quiz', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await GET(request(), { params: params() })).status).toBe(404);
  });
  it('does not leak database errors as a 200', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await GET(request(), { params: params() })).status).toBe(500);
  });
});
