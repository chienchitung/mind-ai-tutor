import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient, createClient } = vi.hoisted(() => ({ getServerClient: vi.fn(), createClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient, SUPABASE_URL: 'https://project.supabase.co' }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
import { POST } from './route';

const request = (body: unknown = { email: 'someone@example.com' }) =>
  new Request('https://test.local/api/team/invite', { method: 'POST', headers: { origin: 'https://test.local', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let auth: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;
let inviteUserByEmail: ReturnType<typeof vi.fn>;
let maybeSingle: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1', email: 'owner@example.com' } }, error: null });
  rpc = vi.fn();
  maybeSingle = vi.fn().mockResolvedValue({ data: { teams: { name: 'My Team' } }, error: null });
  const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }));
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, rpc, from });
  inviteUserByEmail = vi.fn();
  createClient.mockReturnValue({ auth: { admin: { inviteUserByEmail } } });
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/team/invite', () => {
  it('rejects cross-origin requests before touching authentication', async () => {
    const crossOrigin = new Request('https://test.local/api/team/invite', {
      method: 'POST',
      headers: { origin: 'https://attacker.test', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'someone@example.com' }),
    });
    expect((await POST(crossOrigin)).status).toBe(403);
    expect(getServerClient).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated requests', async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a missing email', async () => {
    expect((await POST(request({}))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('adds an existing account immediately, without touching the admin client', async () => {
    rpc.mockResolvedValue({ data: [{ user_id: 'u2', role: 'member' }], error: null });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'added' });
    expect(rpc).toHaveBeenCalledWith('invite_team_member', { p_email: 'someone@example.com' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('surfaces a real RPC failure (e.g. not the owner) without attempting an email invite', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'FORBIDDEN' } });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'FORBIDDEN' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('reports a clear error when the service role key is not configured', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'USER_NOT_FOUND' } });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'SERVICE_ROLE_NOT_CONFIGURED' });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('sends an admin invite email and adds the new account when no account exists yet', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'USER_NOT_FOUND' } })
      .mockResolvedValueOnce({ data: [{ user_id: 'new-user', role: 'member' }], error: null });
    inviteUserByEmail.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });

    const response = await POST(request());

    expect(inviteUserByEmail).toHaveBeenCalledWith('someone@example.com', {
      redirectTo: 'https://test.local/reset-password',
      data: { inviter_email: 'owner@example.com', team_name: 'My Team' },
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'add_team_member_by_id', { p_user_id: 'new-user' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'invited' });
  });

  it('still sends the invite when the team-name lookup comes back empty', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    maybeSingle.mockResolvedValue({ data: null, error: null });
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'USER_NOT_FOUND' } })
      .mockResolvedValueOnce({ data: [{ user_id: 'new-user', role: 'member' }], error: null });
    inviteUserByEmail.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });

    const response = await POST(request());

    expect(inviteUserByEmail).toHaveBeenCalledWith('someone@example.com', {
      redirectTo: 'https://test.local/reset-password',
      data: { inviter_email: 'owner@example.com', team_name: '' },
    });
    expect(response.status).toBe(200);
  });

  it('reports a failed invite email instead of silently succeeding', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'USER_NOT_FOUND' } });
    inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: 'rate limit exceeded' } });

    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'INVITE_EMAIL_FAILED' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
