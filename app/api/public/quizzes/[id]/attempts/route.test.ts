import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
import { POST } from './route';

const id = 'd325432e-0e37-4a6d-a9c8-3fa333b4f077';
const body = { studentName: 'Alex', answers: { q1: 'a', q2: ['b', 'c'] } };
const request = (payload: unknown = body, origin = 'https://test.local') =>
  new Request(`https://test.local/api/public/quizzes/${id}/attempts`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const params = (paramId = id) => Promise.resolve({ id: paramId });
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ rpc });
});

describe('POST /api/public/quizzes/[id]/attempts', () => {
  it('rejects cross-origin requests', async () => {
    expect((await POST(request(body, 'https://other.local'), { params: params() })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects a malformed id', async () => {
    expect((await POST(request(), { params: params('not-a-uuid') })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects an empty student name and oversized answer sets', async () => {
    expect((await POST(request({ studentName: '', answers: {} }), { params: params() })).status).toBe(400);
    const tooMany = Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`q${index}`, 'a']));
    expect((await POST(request({ studentName: 'Alex', answers: tooMany }), { params: params() })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('scores server-side via the RPC and never trusts a client-supplied score', async () => {
    rpc.mockResolvedValue({ data: [{ score: 1, total: 2 }], error: null });
    const response = await POST(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ score: 1, total: 2 });
    expect(rpc).toHaveBeenCalledWith('submit_public_quiz_attempt', { p_quiz_id: id, p_student_name: 'Alex', p_answers: body.answers });
  });
  it('returns 404 for an unshared or nonexistent quiz', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'QUIZ_NOT_FOUND' } });
    expect((await POST(request(), { params: params() })).status).toBe(404);
  });
  it('does not report success for a failed database write', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await POST(request(), { params: params() })).status).toBe(500);
  });
});
