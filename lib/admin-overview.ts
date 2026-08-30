import type { SupabaseClient } from '@supabase/supabase-js';

export const ADMIN_COUNT_TABLES = ['students', 'events', 'lessons', 'feedback'] as const;
export type AdminCountTable = typeof ADMIN_COUNT_TABLES[number];
export interface AdminProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
}
export interface AdminOverview {
  profiles: AdminProfile[];
  profilesError: string | null;
  counts: Record<AdminCountTable, { count: number | null; error: string | null }>;
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && error.code) return error.code;
  return 'ADMIN_LOAD_FAILED';
}

// Abort must settle even if the transport doesn't respond to cancellation.
function abortable<T>(request: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject({ code: 'ADMIN_TIMEOUT' });
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(request).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function loadAdminOverview(client: Pick<SupabaseClient, 'from'>, signal: AbortSignal): Promise<AdminOverview> {
  // The signed-in client and existing RLS define visibility. Do not use a service key
  // to inflate these counts into unrestricted cross-teacher totals.
  const profilesRequest = (async () => {
    try {
      const result = await abortable(client.from('profiles')
        .select('id, user_id, full_name, role, created_at')
        .order('created_at', { ascending: false }).abortSignal(signal), signal);
      if (result.error) return { profiles: [], profilesError: errorCode(result.error) };
      return { profiles: (result.data || []) as AdminProfile[], profilesError: null };
    } catch (error) { return { profiles: [], profilesError: errorCode(error) }; }
  })();
  const countsRequest = Promise.all(ADMIN_COUNT_TABLES.map(async table => {
    try {
      const result = await abortable(client.from(table).select('*', { count: 'exact', head: true }).abortSignal(signal), signal);
      return [table, { count: result.error ? null : result.count, error: result.error ? errorCode(result.error) : result.count === null ? 'ADMIN_LOAD_FAILED' : null }] as const;
    } catch (error) { return [table, { count: null, error: errorCode(error) }] as const; }
  }));
  const [profiles, counts] = await Promise.all([profilesRequest, countsRequest]);
  return { ...profiles, counts: Object.fromEntries(counts) as AdminOverview['counts'] };
}
