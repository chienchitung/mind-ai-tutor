import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// mindaitutor.com/games/* reverse-proxies here (see the main app's
// next.config.ts rewrite + this app's basePath: '/games'), so a teacher/
// admin who is logged into the main app in the same browser already has
// their Supabase auth cookies on this origin - this reads that same
// session rather than requiring a separate login inside game-engine.
async function getRequestScopedClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // This helper is only ever used to read the caller's identity for
        // a single request, never to refresh/persist a session - no-op.
        set() {},
        remove() {},
      },
    },
  );
}

// True only when the request carries a logged-in mindaitutor.com session
// belonging to an admin (public.profiles.role = 'admin', via the same
// is_admin() RPC the main app's RLS policies already use). Anonymous
// student play - the overwhelming majority of traffic here - has no
// session at all and resolves to false without hitting the database in an
// unexpected way.
export async function isAdminRequest(): Promise<boolean> {
  try {
    const client = await getRequestScopedClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return false;
    const { data, error } = await client.rpc('is_admin');
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
