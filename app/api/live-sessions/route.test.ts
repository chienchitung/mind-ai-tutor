import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
import { GET, POST } from './route';

const draft = { title: 'Excel 樞紐分析入門', question: 'SUMIF?', options: ['A', 'B', 'C', 'D'] };
const request = (body: unknown = draft, origin = 'https://test.local') =>
  new Request('https://test.local/api/live-sessions', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let sessionsChain: Record<string, ReturnType<typeof vi.fn>>;
let pollsChain: Record<string, ReturnType<typeof vi.fn>>;
let auth: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionsChain = Object.fromEntries(['insert', 'select', 'single', 'update', 'delete', 'eq'].map((name) => [name, vi.fn()]));
  for (const name of ['insert', 'select', 'update', 'delete', 'eq']) sessionsChain[name].mockReturnValue(sessionsChain);
  sessionsChain.single.mockResolvedValue({ data: { id: 'session-1', join_code: '482910' }, error: null });
  sessionsChain.eq.mockResolvedValue({ error: null });

  pollsChain = Object.fromEntries(['insert', 'select', 'single'].map((name) => [name, vi.fn()]));
  for (const name of ['insert', 'select']) pollsChain[name].mockReturnValue(pollsChain);
  pollsChain.single.mockResolvedValue({ data: { id: 'poll-1' }, error: null });

  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  from = vi.fn((table: string) => (table === 'live_sessions' ? sessionsChain : pollsChain));
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, from });
});

describe('POST /api/live-sessions', () => {
  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests', async () => {
    expect((await POST(request(draft, 'https://other.local'))).status).toBe(403);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects invalid input', async () => {
    expect((await POST(request({ ...draft, options: ['only one'] }))).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it('creates a session with an active poll and returns the join code', async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sessionId: 'session-1', joinCode: '482910' });
    expect(sessionsChain.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'owner', title: draft.title }));
    expect(pollsChain.insert).toHaveBeenCalledWith(expect.objectContaining({ session_id: 'session-1', question: draft.question, options: draft.options }));
    expect(sessionsChain.update).toHaveBeenCalledWith({ active_poll_id: 'poll-1' });
  });
  it('retries once on a join-code collision then succeeds', async () => {
    sessionsChain.single
      .mockResolvedValueOnce({ data: null, error: { code: '23505' } })
      .mockResolvedValueOnce({ data: { id: 'session-1', join_code: '482910' }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(sessionsChain.insert).toHaveBeenCalledTimes(2);
  });
  it('does not retry a non-collision database error', async () => {
    sessionsChain.single.mockResolvedValue({ data: null, error: { code: '42501' } });
    expect((await POST(request())).status).toBe(500);
    expect(sessionsChain.insert).toHaveBeenCalledTimes(1);
  });
  it('rolls back the session if the poll insert fails', async () => {
    pollsChain.single.mockResolvedValue({ data: null, error: { code: '42501' } });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(sessionsChain.delete).toHaveBeenCalled();
  });
  it('reports a clear error when the migration has not been run', async () => {
    sessionsChain.single.mockResolvedValue({ data: null, error: { code: 'PGRST205' } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'LIVE_STORAGE_NOT_READY' });
  });
});

describe('GET /api/live-sessions', () => {
  let listChain: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    listChain = Object.fromEntries(['select', 'eq', 'order', 'limit'].map((name) => [name, vi.fn()]));
    for (const name of ['select', 'eq', 'order']) listChain[name].mockReturnValue(listChain);
    listChain.limit.mockResolvedValue({ data: [], error: null });
    from.mockReturnValue(listChain);
  });

  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET()).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('returns the owner\'s own sessions, most recent first, mapped to camelCase', async () => {
    listChain.limit.mockResolvedValue({
      data: [
        { id: 's1', title: 'Excel 樞紐分析入門', status: 'open', join_code: '482910', created_at: '2026-01-02T00:00:00Z' },
        { id: 's2', title: '舊場次', status: 'closed', join_code: '111222', created_at: '2026-01-01T00:00:00Z' },
      ],
      error: null,
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: 's1', title: 'Excel 樞紐分析入門', status: 'open', joinCode: '482910', createdAt: '2026-01-02T00:00:00Z' },
      { id: 's2', title: '舊場次', status: 'closed', joinCode: '111222', createdAt: '2026-01-01T00:00:00Z' },
    ]);
    expect(listChain.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(listChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
  it('returns an empty list when the teacher has no sessions', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
  it('does not leak database errors as a 200', async () => {
    listChain.limit.mockResolvedValue({ data: null, error: { code: '42501' } });
    expect((await GET()).status).toBe(500);
  });
});
