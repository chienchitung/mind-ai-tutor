import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadAdminOverview } from './admin-overview';

type Result = { data?: unknown[] | null; count?: number | null; error: { code: string } | null };
function mockClient(overrides: Record<string, Result | Promise<Result>> = {}) {
  const queries: Array<{ table: string; method: string; args: unknown[] }> = [];
  const profile = { id: 'profile', user_id: 'user', full_name: null, role: 'admin', created_at: '2026-08-30' };
  const from = (table: string) => {
    const chain = {
      select: (...args: unknown[]) => { queries.push({ table, method: 'select', args }); return chain; },
      order: (...args: unknown[]) => { queries.push({ table, method: 'order', args }); return chain; },
      abortSignal: () => overrides[table] || (table === 'profiles'
        ? { data: [profile], error: null }
        : { count: table === 'lessons' ? 7 : 0, error: null }),
    };
    return chain;
  };
  return { client: { from } as unknown as Pick<SupabaseClient, 'from'>, queries };
}

describe('admin overview loader', () => {
  it('loads the five queries once, preserves zero counts, and keeps nullable profiles', async () => {
    const { client, queries } = mockClient();
    const result = await loadAdminOverview(client, new AbortController().signal);
    expect(result.profiles[0].full_name).toBeNull();
    expect(result.profilesError).toBeNull();
    expect(result.counts.students).toEqual({ count: 0, error: null });
    expect(result.counts.lessons).toEqual({ count: 7, error: null });
    expect(queries.filter(query => query.method === 'select')).toHaveLength(5);
    expect(queries.find(query => query.table === 'lessons')?.args).toEqual(['*', { count: 'exact', head: true }]);
  });

  it('keeps counts visible when profiles are unavailable', async () => {
    const { client } = mockClient({ profiles: { data: null, error: { code: '42501' } } });
    const result = await loadAdminOverview(client, new AbortController().signal);
    expect(result.profiles).toEqual([]);
    expect(result.profilesError).toBe('42501');
    expect(result.counts.lessons.count).toBe(7);
  });

  it('does not disguise failed counts as zero or fail the other panels', async () => {
    const { client } = mockClient({ feedback: { count: 0, error: { code: '42P01' } } });
    const result = await loadAdminOverview(client, new AbortController().signal);
    expect(result.counts.feedback).toEqual({ count: null, error: '42P01' });
    expect(result.profiles).toHaveLength(1);
    expect(result.counts.lessons.count).toBe(7);
  });

  it('treats a missing count as a failure, not an empty table', async () => {
    const { client } = mockClient({ events: { count: null, error: null } });
    const result = await loadAdminOverview(client, new AbortController().signal);
    expect(result.counts.events).toEqual({ count: null, error: 'ADMIN_LOAD_FAILED' });
  });

  it('finishes after cancellation even if the profiles transport never settles', async () => {
    const { client } = mockClient({ profiles: new Promise(() => {}) });
    const controller = new AbortController();
    const pending = loadAdminOverview(client, controller.signal);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    const result = await pending;
    expect(result.profilesError).toBe('ADMIN_TIMEOUT');
    expect(result.counts.lessons.count).toBe(7);
  });

  it('handles an already aborted request without hanging', async () => {
    const controller = new AbortController();
    controller.abort();
    const { client } = mockClient();
    const result = await loadAdminOverview(client, controller.signal);
    expect(result.profilesError).toBe('ADMIN_TIMEOUT');
    expect(result.counts.students.error).toBe('ADMIN_TIMEOUT');
  });
});
