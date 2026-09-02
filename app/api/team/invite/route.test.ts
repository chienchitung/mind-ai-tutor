import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient, createClient } = vi.hoisted(() => ({ getServerClient: vi.fn(), createClient: vi.fn() }));
vi.mock('@/app/lib/supabase', () => ({ getServerClient, SUPABASE_URL: 'https://project.supabase.co' }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
import { POST } from './route';

const request = (body: unknown = { email: 'someone@example.com' }) =>
  new Request('https://test.local/api/team/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let auth: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;
let inviteUserByEmail: ReturnType<typeof vi.fn>;

beforeEach(() => {
  auth = vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null });
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ auth: { getUser: auth }, rpc });
  inviteUserByEmail = vi.fn();
  createClient.mockReturnValue({ auth: { admin: { inviteUserByEmail } } });
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/team/invite', () => {
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

    expect(inviteUserByEmail).toHaveBeenCalledWith('someone@example.com', { redirectTo: 'https://test.local/reset-password' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'add_team_member_by_id', { p_user_id: 'new-user' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'invited' });
  });

  it('reports a failed invite email instead of silently succeeding', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'USER_NOT_FOUND' } });
    inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: 'rate limit exceeded' } });

    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'rate limit exceeded' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
