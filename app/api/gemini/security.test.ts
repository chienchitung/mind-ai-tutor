import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient }));
import { authorizeTeacherAi, claimTeacherAi } from './security';

const request = (origin = 'https://app.test') =>
  new Request('https://app.test/api/gemini/quiz', { method: 'POST', headers: { origin } });

let getUser: ReturnType<typeof vi.fn>;
let maybeSingle: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;
let client: {
  auth: { getUser: ReturnType<typeof vi.fn> };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'teacher-1' } }, error: null });
  maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'teacher' }, error: null });
  rpc = vi.fn().mockResolvedValue({ data: 'OK', error: null });
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  client = { auth: { getUser }, from: vi.fn().mockReturnValue(chain), rpc };
  getServerClient.mockResolvedValue(client);
});

describe('teacher AI authorization and quotas', () => {
  it('rejects cross-origin before reading a session', async () => {
    const result = await authorizeTeacherAi(request('https://evil.test'));
    expect(result.response?.status).toBe(403);
    expect(getServerClient).not.toHaveBeenCalled();
  });

  it('requires a verified user and teacher/admin role', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await authorizeTeacherAi(request())).response?.status).toBe(401);
    getUser.mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: 'student' }, error: null });
    expect((await authorizeTeacherAi(request())).response?.status).toBe(403);
  });

  it('fails closed when the durable quota is unavailable or exceeded', async () => {
    expect(await claimTeacherAi(client as never, 'quiz')).toBeNull();
    rpc.mockResolvedValue({ data: 'DAILY_LIMIT', error: null });
    expect((await claimTeacherAi(client as never, 'quiz'))?.status).toBe(429);
    rpc.mockResolvedValue({ data: null, error: { message: 'missing function' } });
    expect((await claimTeacherAi(client as never, 'quiz'))?.status).toBe(503);
  });
});
