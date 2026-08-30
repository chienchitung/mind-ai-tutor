import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
import { GET, POST } from './route';

const quiz = { id: 'd325432e-0e37-4a6d-a9c8-3fa333b4f077', title: 'Test', questions: [{ id: 'q1', questionText: 'Q', options: [], correctAnswer: '42', explanation: '' }] };
const request = (body: unknown, origin = 'https://test.local') => new Request('https://test.local/api/quizzes', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let chain: Record<string, ReturnType<typeof vi.fn>>;
let auth: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  chain = Object.fromEntries(['select', 'eq', 'order', 'limit', 'upsert', 'single'].map(name => [name, vi.fn()]));
  for (const fn of Object.values(chain)) fn.mockReturnValue(chain);
  chain.limit.mockResolvedValue({ data: [], error: null });
  chain.single.mockResolvedValue({ data: quiz, error: null });
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  from = vi.fn().mockReturnValue(chain);
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, from });
});

describe('private quiz API', () => {
  it('rejects unauthenticated reads and writes', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET()).status).toBe(401);
    expect((await POST(request(quiz))).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('filters the library by the verified user and limits the list', async () => {
    expect((await GET()).status).toBe(200);
    expect(from).toHaveBeenCalledWith('ai_quizzes');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(chain.limit).toHaveBeenCalledWith(50);
  });
  it('never accepts an owner from the payload', async () => {
    expect((await POST(request({ ...quiz, user_id: 'attacker' }))).status).toBe(200);
    expect(chain.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'owner', id: quiz.id }), { onConflict: 'id' });
  });
  it('rejects invalid payloads and cross-origin writes', async () => {
    expect((await POST(request({ ...quiz, questions: [] }))).status).toBe(400);
    expect((await POST(request(quiz, 'https://other.local'))).status).toBe(403);
    expect(chain.upsert).not.toHaveBeenCalled();
  });
  it('returns a useful failure when the migration is not installed', async () => {
    chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST205' } });
    const response = await POST(request(quiz));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'QUIZ_STORAGE_NOT_READY' });
  });
  it('does not report success for a failed database write', async () => {
    chain.single.mockResolvedValue({ data: null, error: { code: '42501' } });
    expect((await POST(request(quiz))).status).toBe(500);
  });
});
