import { NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'crypto';
import { getServerClient } from '@/app/lib/supabase';

export const runtime = 'nodejs';

async function requireUser() {
  const client = await getServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return { client, user };
}

// GET creates the integration row on first call (idempotent from the
// caller's point of view) so the settings UI can just fetch this and
// render a webhook URL immediately, no separate "activate" step.
export async function GET() {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { client, user } = auth;

  const { data: existing, error: fetchError } = await client
    .from('systeme_integrations')
    .select('webhook_token, webhook_secret, created_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(existing);
  }

  const { data: created, error: insertError } = await client
    .from('systeme_integrations')
    .insert({ user_id: user.id, webhook_secret: randomBytes(32).toString('hex') })
    .select('webhook_token, webhook_secret, created_at')
    .single();

  if (insertError || !created) {
    return NextResponse.json({ error: 'CREATE_FAILED' }, { status: 500 });
  }
  return NextResponse.json(created);
}

// POST rotates the token and secret - the old webhook URL stops working
// immediately, for when a URL/secret may have leaked.
export async function POST() {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { client, user } = auth;

  const { data: rotated, error } = await client
    .from('systeme_integrations')
    .update({ webhook_token: randomUUID(), webhook_secret: randomBytes(32).toString('hex') })
    .eq('user_id', user.id)
    .select('webhook_token, webhook_secret, created_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'ROTATE_FAILED' }, { status: 500 });
  if (rotated) return NextResponse.json(rotated);

  // No row existed yet to rotate - same first-time creation as GET.
  const { data: created, error: insertError } = await client
    .from('systeme_integrations')
    .insert({ user_id: user.id, webhook_secret: randomBytes(32).toString('hex') })
    .select('webhook_token, webhook_secret, created_at')
    .single();

  if (insertError || !created) {
    return NextResponse.json({ error: 'CREATE_FAILED' }, { status: 500 });
  }
  return NextResponse.json(created);
}
