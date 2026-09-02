import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerClient, SUPABASE_URL } from '@/app/lib/supabase';

export const runtime = 'nodejs';

// SUPABASE_SERVICE_ROLE_KEY bypasses every RLS policy in the project - the
// single most sensitive credential this app has. It must only ever be read
// here, on the server, and only for this one call (auth.admin.inviteUserByEmail
// requires it; there is no lower-privilege way to create an auth.users row).
// Never expose it as NEXT_PUBLIC_*, never send it to the client, never log it.
function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createClient(SUPABASE_URL, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    // Try the cheap, existing-account path first - it already does every
    // ownership/role/self-invite/already-in-a-team check we need.
    const existing = await client.rpc('invite_team_member', { p_email: email });
    if (!existing.error) {
      return NextResponse.json({ status: 'added' });
    }
    if (!existing.error.message?.includes('USER_NOT_FOUND')) {
      // A real failure (FORBIDDEN, NO_TEAM, CANNOT_INVITE_SELF, ALREADY_IN_A_TEAM,
      // or something unexpected) - surface it as-is, same as before this route existed.
      return NextResponse.json({ error: existing.error.message }, { status: 400 });
    }

    // No account for this email yet - send a real invite instead.
    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'SERVICE_ROLE_NOT_CONFIGURED' }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const invited = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (invited.error || !invited.data.user) {
      return NextResponse.json({ error: invited.error?.message || 'INVITE_EMAIL_FAILED' }, { status: 502 });
    }

    // Add the newly-created (unconfirmed) account to the team now - they
    // become a full member as soon as they follow the email link and set a
    // password, no separate "claim my pending invite" step needed.
    const added = await client.rpc('add_team_member_by_id', { p_user_id: invited.data.user.id });
    if (added.error) {
      return NextResponse.json({ error: added.error.message }, { status: 400 });
    }

    return NextResponse.json({ status: 'invited' });
  } catch (error) {
    console.error('Error in /api/team/invite:', error);
    return NextResponse.json({ error: 'UNEXPECTED_ERROR' }, { status: 500 });
  }
}
