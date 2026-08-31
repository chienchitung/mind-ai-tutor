import { NextResponse } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { mapQuestionRow } from '@/lib/live-session';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Teacher-only: every question for their own session, including ones
// they've hidden from the audience, sorted by upvotes for a moderation queue.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, error } = await client.rpc('get_live_questions_for_owner', { p_session_id: id });
    if (error) {
      // The RPC raises FORBIDDEN both when the session doesn't exist and when
      // it belongs to someone else - either way this caller gets nothing.
      const status = error.message?.includes('FORBIDDEN') ? 404 : 500;
      return NextResponse.json({ error: status === 404 ? 'NOT_FOUND' : 'LIVE_STORAGE_ERROR' }, { status });
    }
    return NextResponse.json((data ?? []).map(mapQuestionRow), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}
