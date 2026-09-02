import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));
import { middleware } from './middleware';

describe('system administration access stays restricted', () => {
  const getUser = vi.fn();
  const single = vi.fn();
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'admin-user' } }, error: null });
    single.mockResolvedValue({ data: { role: 'admin' }, error: null });
    createServerClient.mockReturnValue({ auth: { getUser }, from });
  });

  it('redirects anonymous visitors to login', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await middleware(new NextRequest('https://test.local/admin'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://test.local/login?redirect=%2Fadmin');
    expect(from).not.toHaveBeenCalled();
  });

  it('does not allow teachers to open administration', async () => {
    single.mockResolvedValue({ data: { role: 'teacher' }, error: null });
    const response = await middleware(new NextRequest('https://test.local/admin'));
    expect(response.headers.get('location')).toBe('https://test.local/dashboard');
  });

  it('allows an admin only after checking the signed-in user’s profile', async () => {
    const response = await middleware(new NextRequest('https://test.local/admin'));
    expect(eq).toHaveBeenCalledWith('user_id', 'admin-user');
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('fails closed when the role cannot be verified', async () => {
    single.mockResolvedValue({ data: null, error: { code: '57014' } });
    const response = await middleware(new NextRequest('https://test.local/admin'));
    expect(response.headers.get('x-middleware-next')).toBeNull();
    expect(response.headers.get('location')).toBe('https://test.local/dashboard');
  });
});

describe('authenticated-only pages redirect anonymous visitors to login', () => {
  const getUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    createServerClient.mockReturnValue({ auth: { getUser } });
  });

  it.each([
    '/students',
    '/lessons',
    '/digital-games',
    '/ai-quiz',
    '/events',
    '/feedback',
    '/activities',
    '/reports',
    '/settings',
    '/profile',
    '/subscription',
    '/live/new',
    '/live/sessions',
    '/live/abc123/present',
  ])('redirects anonymous visitors from %s', async (path) => {
    const response = await middleware(new NextRequest(`https://test.local${path}`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`https://test.local/login?redirect=${encodeURIComponent(path)}`);
  });

  it.each([
    '/live',
    '/live/abc123',
    '/quiz/xyz',
  ])('leaves the public page %s alone for anonymous visitors', async (path) => {
    const response = await middleware(new NextRequest(`https://test.local${path}`));
    expect(response.headers.get('location')).toBeNull();
  });
});
